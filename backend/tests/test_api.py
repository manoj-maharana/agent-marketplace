import asyncio

from fastapi.testclient import TestClient

from app.framework.skills import skill_registry
from app.main import app


def test_health():
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


def test_list_agents_seeded():
    with TestClient(app) as client:
        resp = client.get("/api/agents", params={"page_size": 50})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 30

        # Most seeded agents share one insert-time updated_at, so which ones
        # land in an arbitrary default-order page is DB-engine-dependent
        # (this flaked between local SQLite and CI's SQLite build). Look the
        # agent up directly instead of assuming its position in a truncated
        # default-order page, matching the pattern the rest of this suite uses.
        search = client.get("/api/agents", params={"q": "Study Buddy", "page_size": 5})
        assert any(a["slug"] == "study-buddy" for a in search.json()["items"])


def test_list_skills_seeded():
    with TestClient(app) as client:
        resp = client.get("/api/skills", params={"page_size": 50})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 15
        assert any(s["is_functional"] for s in data["items"])


def test_agent_filter_by_category():
    with TestClient(app) as client:
        resp = client.get("/api/agents", params={"category": "education", "page_size": 50})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 4
        assert all(a["category"]["slug"] == "education" for a in data["items"])


def test_agent_search():
    with TestClient(app) as client:
        resp = client.get("/api/agents", params={"q": "budget"})
        assert resp.status_code == 200
        data = resp.json()
        assert any(a["slug"] == "budget-buddy" for a in data["items"])


def test_create_agent_appears_in_library():
    with TestClient(app) as client:
        create_resp = client.post(
            "/api/agents",
            json={
                "title": "Test Agent",
                "description": "A test agent",
                "system_prompt": "You are a test agent.",
                "skill_ids": [],
            },
        )
        assert create_resp.status_code == 201
        agent = create_resp.json()
        assert agent["is_installed"] is True
        assert agent["is_custom"] is True

        library_resp = client.get("/api/agents", params={"scope": "library", "page_size": 50})
        assert any(a["id"] == agent["id"] for a in library_resp.json()["items"])


def test_install_marketplace_agent():
    with TestClient(app) as client:
        list_resp = client.get("/api/agents", params={"q": "Recipe Remixer"})
        target = list_resp.json()["items"][0]
        assert target["is_installed"] is False

        install_resp = client.post(f"/api/agents/{target['id']}/install")
        assert install_resp.status_code == 200
        assert install_resp.json()["is_installed"] is True


def test_chat_without_azure_config_returns_error_event():
    with TestClient(app) as client:
        agents = client.get("/api/agents", params={"q": "Study Buddy"}).json()["items"]
        agent_id = agents[0]["id"]

        conv = client.post("/api/chat/conversations", json={"agent_id": agent_id})
        assert conv.status_code == 201
        conversation_id = conv.json()["id"]

        with client.stream(
            "POST",
            f"/api/chat/conversations/{conversation_id}/messages",
            json={"content": "Hello"},
        ) as resp:
            assert resp.status_code == 200
            body = "".join(resp.iter_text())
        assert '"type": "error"' in body


def test_conversation_auto_titles_from_first_message():
    with TestClient(app) as client:
        agents = client.get("/api/agents", params={"q": "Study Buddy"}).json()["items"]
        agent_id = agents[0]["id"]

        conv = client.post("/api/chat/conversations", json={"agent_id": agent_id})
        conversation_id = conv.json()["id"]
        assert conv.json()["title"] == f"Chat with {agents[0]['title']}"

        with client.stream(
            "POST",
            f"/api/chat/conversations/{conversation_id}/messages",
            json={"content": "Help me study for my chemistry exam"},
        ) as resp:
            list(resp.iter_text())

        convs = client.get("/api/chat/conversations", params={"agent_id": agent_id}).json()
        updated = next(c for c in convs if c["id"] == conversation_id)
        assert updated["title"] == "Help me study for my chemistry exam"


def test_fork_agent_creates_editable_copy_without_touching_original():
    with TestClient(app) as client:
        items = client.get("/api/agents", params={"q": "Study Buddy"}).json()["items"]
        original = next(a for a in items if not a["is_custom"])

        fork_resp = client.post(f"/api/agents/{original['id']}/fork")
        assert fork_resp.status_code == 201
        forked = fork_resp.json()
        assert forked["id"] != original["id"]
        assert forked["is_custom"] is True
        assert forked["title"] == original["title"]

        edit_resp = client.patch(
            f"/api/agents/{forked['id']}",
            json={"system_prompt": "You are a customized study buddy."},
        )
        assert edit_resp.status_code == 200
        assert edit_resp.json()["system_prompt"] == "You are a customized study buddy."

        original_again = client.get(f"/api/agents/{original['id']}").json()
        assert original_again["system_prompt"] != "You are a customized study buddy."


def test_cannot_edit_or_delete_non_custom_agent():
    with TestClient(app) as client:
        items = client.get("/api/agents", params={"q": "Study Buddy"}).json()["items"]
        original = next(a for a in items if not a["is_custom"])

        patch_resp = client.patch(f"/api/agents/{original['id']}", json={"title": "Hacked"})
        assert patch_resp.status_code == 400

        delete_resp = client.delete(f"/api/agents/{original['id']}")
        assert delete_resp.status_code == 400


def test_delete_custom_agent():
    with TestClient(app) as client:
        create_resp = client.post(
            "/api/agents",
            json={"title": "Disposable Agent", "system_prompt": "Temp.", "skill_ids": []},
        )
        agent_id = create_resp.json()["id"]

        delete_resp = client.delete(f"/api/agents/{agent_id}")
        assert delete_resp.status_code == 204

        get_resp = client.get(f"/api/agents/{agent_id}")
        assert get_resp.status_code == 404


def test_assistant_routes_and_persists_turn_without_azure_config():
    with TestClient(app) as client:
        agents = client.get("/api/agents", params={"q": "Study Buddy"}).json()["items"]
        agent_id = agents[0]["id"]
        client.post(f"/api/agents/{agent_id}/install")

        thread = client.post("/api/assistant/threads", json={}).json()
        thread_id = thread["id"]
        assert thread["title"] == "New thread"

        with client.stream(
            "POST", f"/api/assistant/threads/{thread_id}/messages", json={"content": "Help me study for chemistry"}
        ) as resp:
            assert resp.status_code == 200
            body = "".join(resp.iter_text())
        assert '"type": "route"' in body
        # Azure isn't configured in tests, so the delegated agent's own stream_chat call
        # surfaces the same "not configured" message regular chat does - folded into the
        # agent's content rather than a raw error event, since with multiple agents an
        # error needs to be attributable to whichever one produced it.
        assert "not configured" in body

        msgs = client.get(f"/api/assistant/threads/{thread_id}/messages").json()
        assert [m["role"] for m in msgs] == ["user", "assistant"]
        assert msgs[0]["content"] == "Help me study for chemistry"
        assert "not configured" in msgs[1]["content"]

        updated_thread = client.get("/api/assistant/threads").json()
        assert next(t for t in updated_thread if t["id"] == thread_id)["title"] == "Help me study for chemistry"


def test_assistant_thread_list_and_delete():
    with TestClient(app) as client:
        thread = client.post("/api/assistant/threads", json={"title": "Scratch thread"}).json()
        thread_id = thread["id"]

        listing = client.get("/api/assistant/threads").json()
        assert any(t["id"] == thread_id for t in listing)

        del_resp = client.delete(f"/api/assistant/threads/{thread_id}")
        assert del_resp.status_code == 204

        listing_after = client.get("/api/assistant/threads").json()
        assert not any(t["id"] == thread_id for t in listing_after)


def test_assistant_message_with_no_library_agents_returns_clear_error():
    with TestClient(app) as client:
        # A fresh custom agent that's never installed/created won't exist here,
        # but every seeded agent could already be installed by other tests in
        # this session's shared DB - so instead exercise plan_route directly
        # against an empty agent list, which is the actual "nothing to route
        # to" case regardless of what's installed elsewhere.
        import asyncio

        from app.framework.assistant_router import plan_route, run_assistant_turn

        plan = asyncio.run(plan_route("anything", []))
        assert plan["agent_ids"] == []

        async def collect():
            return [e async for e in run_assistant_turn("anything", {}, plan)]

        events = asyncio.run(collect())
        assert events[0]["type"] == "error"
        assert "library" in events[0]["message"]


def test_task_scheduler_recurrence_math():
    from datetime import datetime, timezone

    from app.framework.task_scheduler import compute_next_run

    now = datetime(2026, 1, 5, 8, 0, tzinfo=timezone.utc)  # a Monday
    # Daily: target hour today hasn't passed yet -> runs today.
    assert compute_next_run("daily", None, 9, now) == datetime(2026, 1, 5, 9, 0, tzinfo=timezone.utc)
    # Daily: target hour today already passed -> runs tomorrow.
    assert compute_next_run("daily", None, 7, now) == datetime(2026, 1, 6, 7, 0, tzinfo=timezone.utc)
    # Weekly: next occurrence of the given weekday (0=Mon), same week if not yet passed.
    assert compute_next_run("weekly", 2, 9, now) == datetime(2026, 1, 7, 9, 0, tzinfo=timezone.utc)  # Wed
    # Once: never auto-scheduled.
    assert compute_next_run("once", None, 9, now) is None


def test_task_crud_and_recurrence_scheduling():
    with TestClient(app) as client:
        agents = client.get("/api/agents", params={"q": "Study Buddy"}).json()["items"]
        agent_id = agents[0]["id"]

        plain = client.post("/api/tasks", json={"title": "Buy groceries"}).json()
        assert plain["next_run_at"] is None  # plain checklist item - never auto-scheduled

        recurring = client.post(
            "/api/tasks",
            json={
                "title": "Daily learning bite",
                "agent_id": agent_id,
                "recurrence": "daily",
                "recurrence_hour": 9,
            },
        ).json()
        assert recurring["next_run_at"] is not None
        assert recurring["agent"]["id"] == agent_id

        listing = client.get("/api/tasks").json()
        assert any(t["id"] == plain["id"] for t in listing)
        assert any(t["id"] == recurring["id"] for t in listing)

        patched = client.patch(f"/api/tasks/{recurring['id']}", json={"recurrence": "once"}).json()
        assert patched["next_run_at"] is None  # switching to "once" clears the schedule

        assert client.delete(f"/api/tasks/{plain['id']}").status_code == 204
        assert client.get("/api/tasks").json()
        assert not any(t["id"] == plain["id"] for t in client.get("/api/tasks").json())


def test_task_run_now_without_agent_returns_400():
    with TestClient(app) as client:
        plain = client.post("/api/tasks", json={"title": "No agent here"}).json()
        resp = client.post(f"/api/tasks/{plain['id']}/run-now")
        assert resp.status_code == 400


def test_task_run_now_without_azure_config_records_run():
    with TestClient(app) as client:
        agents = client.get("/api/agents", params={"q": "Study Buddy"}).json()["items"]
        agent_id = agents[0]["id"]
        task = client.post("/api/tasks", json={"title": "Test run", "agent_id": agent_id}).json()

        resp = client.post(f"/api/tasks/{task['id']}/run-now")
        assert resp.status_code == 201
        assert "not configured" in resp.json()["output"]

        runs = client.get(f"/api/tasks/{task['id']}/runs").json()
        assert len(runs) == 1


def test_check_due_runs_and_reschedules_due_tasks():
    import asyncio
    from datetime import timedelta

    from app.db import async_session_factory
    from app.framework.task_scheduler import check_and_run_due_tasks
    from app.models import Task, utcnow

    with TestClient(app) as client:
        agents = client.get("/api/agents", params={"q": "Study Buddy"}).json()["items"]
        agent_id = agents[0]["id"]
        created = client.post(
            "/api/tasks",
            json={
                "title": "Overdue task",
                "agent_id": agent_id,
                "recurrence": "daily",
                "recurrence_hour": 9,
            },
        ).json()
        task_id = created["id"]

        # A freshly-created task's next_run_at is always in the future by
        # construction - force it into the past directly to simulate time
        # having passed, then exercise the same due-check the API uses.
        async def make_overdue_and_check():
            async with async_session_factory() as db:
                task = await db.get(Task, task_id)
                task.next_run_at = utcnow() - timedelta(hours=1)
                await db.commit()
            async with async_session_factory() as db:
                return await check_and_run_due_tasks(db)

        ran = asyncio.run(make_overdue_and_check())
        assert any(r["task_id"] == task_id for r in ran)

        after = next(t for t in client.get("/api/tasks").json() if t["id"] == task_id)
        assert after["last_run_at"] is not None
        assert after["next_run_at"] is not None  # rescheduled forward, not left null


def test_resource_upload_without_storage_configured():
    with TestClient(app) as client:
        resp = client.post(
            "/api/resources",
            files={"file": ("notes.pdf", b"%PDF-1.4", "application/pdf")},
        )
        assert resp.status_code == 400
        assert "not configured" in resp.json()["detail"]


def test_resource_upload_rejects_unsupported_extension():
    with TestClient(app) as client:
        resp = client.post(
            "/api/resources",
            files={"file": ("virus.exe", b"MZ", "application/octet-stream")},
        )
        assert resp.status_code == 400
        assert "Unsupported file type" in resp.json()["detail"]


def test_resource_list_starts_empty():
    with TestClient(app) as client:
        resp = client.get("/api/resources")
        assert resp.status_code == 200
        assert resp.json() == []


def test_regex_tester_skill():
    result = asyncio.run(skill_registry.call("regex_tester", {"pattern": r"\d+", "text": "a1 b22 c333"}))
    assert result["valid"] is True
    assert result["match_count"] == 3
    assert [m["match"] for m in result["matches"]] == ["1", "22", "333"]


def test_csv_explorer_skill():
    csv_text = "name,age\nAlice,30\nBob,25\n"
    result = asyncio.run(skill_registry.call("csv_explorer", {"csv_text": csv_text}))
    assert result["row_count"] == 2
    assert result["columns"]["age"]["type"] == "number"
    assert result["columns"]["age"]["min"] == 25


def test_citation_formatter_skill():
    result = asyncio.run(
        skill_registry.call(
            "citation_formatter",
            {
                "style": "apa",
                "author": "Doe, J.",
                "title": "A Study",
                "year": "2024",
                "source": "Journal of Examples",
            },
        )
    )
    assert result["citation"] == "Doe, J. (2024). A Study. Journal of Examples."


def test_json_formatter_skill():
    result = asyncio.run(skill_registry.call("json_formatter", {"json_text": '{"a":1,"b":[1,2]}'}))
    assert result["valid"] is True
    assert result["formatted"] == '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}'

    bad = asyncio.run(skill_registry.call("json_formatter", {"json_text": "{not json}"}))
    assert bad["valid"] is False


def test_keyword_extractor_skill():
    text = "The quick brown fox jumps over the lazy dog. The dog barks at the fox."
    result = asyncio.run(skill_registry.call("keyword_extractor", {"text": text, "top_n": 3}))
    words = [k["word"] for k in result["keywords"]]
    assert "dog" in words
    assert "fox" in words
    assert "the" not in words


def test_color_palette_generator_skill():
    result = asyncio.run(skill_registry.call("color_palette_generator", {"description": "calm ocean morning"}))
    assert len(result["palette"]) == 5
    assert all(c.startswith("#") and len(c) == 7 for c in result["palette"])
    # deterministic: same input always produces the same palette
    again = asyncio.run(skill_registry.call("color_palette_generator", {"description": "calm ocean morning"}))
    assert result["palette"] == again["palette"]


def test_skill_packages_all_loaded():
    from app.framework import skill_loader

    docs = skill_loader.load_skill_docs()
    assert len(docs) == 64  # 62 + list-my-agents + list-my-agent-groups
    functional = [d for d in docs if d.functional]
    assert len(functional) == 15
    assert all(d.tool_key and skill_registry.get(d.tool_key) for d in functional)


def test_list_my_agents_skill():
    result = asyncio.run(skill_registry.call("list_my_agents", {}))
    assert result["count"] >= 1
    assert any(a["title"] == "Workspace Assistant" for a in result["agents"])


def test_list_my_agent_groups_skill():
    result = asyncio.run(skill_registry.call("list_my_agent_groups", {}))
    assert "groups" in result
    assert isinstance(result["count"], int)


def test_agent_group_crud_and_modes():
    with TestClient(app) as client:
        agents = client.get("/api/agents", params={"page_size": 3}).json()["items"]
        member_ids = [a["id"] for a in agents[:2]]

        create_resp = client.post(
            "/api/experimental/deepagents/groups",
            json={
                "name": "Content Team",
                "description": "Research then write.",
                "mode": "sequential",
                "orchestrator_prompt": "Summarize the team's work.",
                "iterations": 2,
                "members": [
                    {"agent_id": member_ids[0], "role_label": "researcher"},
                    {"agent_id": member_ids[1], "role_label": None},
                ],
            },
        )
        assert create_resp.status_code == 201
        group = create_resp.json()
        assert group["mode"] == "sequential"
        assert len(group["members"]) == 2
        assert group["members"][0]["role_label"] == "researcher"
        assert group["members"][0]["agent"]["id"] == member_ids[0]
        group_id = group["id"]

        get_resp = client.get(f"/api/experimental/deepagents/groups/{group_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["name"] == "Content Team"

        list_resp = client.get("/api/experimental/deepagents/groups")
        assert list_resp.status_code == 200
        assert any(g["id"] == group_id for g in list_resp.json()["items"])

        delete_resp = client.delete(f"/api/experimental/deepagents/groups/{group_id}")
        assert delete_resp.status_code == 204
        assert client.get(f"/api/experimental/deepagents/groups/{group_id}").status_code == 404


def test_agent_group_create_rejects_unknown_mode():
    with TestClient(app) as client:
        resp = client.post(
            "/api/experimental/deepagents/groups",
            json={"name": "Bad Group", "mode": "chaos", "members": []},
        )
        assert resp.status_code == 400


def test_agent_group_create_rejects_unknown_agent_id():
    with TestClient(app) as client:
        resp = client.post(
            "/api/experimental/deepagents/groups",
            json={"name": "Bad Group", "mode": "parallel", "members": [{"agent_id": 999999}]},
        )
        assert resp.status_code == 400


def test_agent_group_run_without_azure_config_returns_400():
    with TestClient(app) as client:
        agents = client.get("/api/agents", params={"page_size": 1}).json()["items"]
        create_resp = client.post(
            "/api/experimental/deepagents/groups",
            json={
                "name": "Debate Club",
                "mode": "debate",
                "members": [{"agent_id": agents[0]["id"]}],
            },
        )
        group_id = create_resp.json()["id"]

        run_resp = client.post(
            f"/api/experimental/deepagents/groups/{group_id}/run", json={"message": "Topic?"}
        )
        assert run_resp.status_code == 400
        assert "not configured" in run_resp.json()["detail"]


def test_knowledge_upload_without_embeddings_configured():
    with TestClient(app) as client:
        agents = client.get("/api/agents", params={"q": "Study Buddy"}).json()["items"]
        agent_id = agents[0]["id"]

        resp = client.post(
            f"/api/agents/{agent_id}/knowledge",
            files={"file": ("notes.txt", b"Some study notes.", "text/plain")},
        )
        assert resp.status_code == 400
        assert "not configured" in resp.json()["detail"]


def test_knowledge_upload_rejects_unsupported_extension():
    with TestClient(app) as client:
        agents = client.get("/api/agents", params={"q": "Study Buddy"}).json()["items"]
        agent_id = agents[0]["id"]

        resp = client.post(
            f"/api/agents/{agent_id}/knowledge",
            files={"file": ("notes.pdf", b"%PDF-1.4", "application/pdf")},
        )
        assert resp.status_code == 400
        assert "txt" in resp.json()["detail"]
