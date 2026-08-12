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
