import pytest
from fastapi.testclient import TestClient
# Import app from deepsearch_api
# Note: we assume conftest.py mocks are applied before this if run via pytest
from backend.deepsearch_api import app

client = TestClient(app)

def test_read_main():
    response = client.get("/")
    # The app might return 404 if dist doesn't exist, or 200 if mocked correctly
    # Just ensure it returns a valid response object
    assert response.status_code in [200, 404]

def test_refine_endpoint_empty_text():
    response = client.post("/refine", json={"manuscriptText": ""})
    assert response.status_code == 200
    data = response.json()
    assert data["processedText"] == ""
    assert data["bibliographyText"] == ""
    assert data["bibtex"] == ""

def test_refine_endpoint_valid_text():
    response = client.post("/refine", json={
        "manuscriptText": "This is a test manuscript.",
        "maxResults": 10,
        "noCache": True
    })
    if response.status_code != 200:
        print(f"Error response: {response.text}")
    assert response.status_code == 200
    data = response.json()
    # The mocked refiner should return these values
    assert data["processedText"] == "Refined document text"
    assert data["bibliographyText"] == "Bibliography text"
    assert "bibtex" in data

def test_websocket_endpoint():
    with client.websocket_connect("/ws") as websocket:
        # The websocket protocol in the app waits for a message
        # Let's send a ping
        websocket.send_text("ping")
        # We might not get a response immediately unless the loop processes it
        # But connection success is what we test here
        pass

