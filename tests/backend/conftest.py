import pytest
from unittest.mock import MagicMock
import sys

# Mock the heavy ML libraries before they are imported by DEEPSEARCH
sys.modules["torch"] = MagicMock()
sys.modules["transformers"] = MagicMock()
sys.modules["sentence_transformers"] = MagicMock()
sys.modules["yake"] = MagicMock()
sys.modules["sklearn"] = MagicMock()
sys.modules["sklearn.metrics.pairwise"] = MagicMock()
sys.modules["nltk"] = MagicMock()

# Now import the app
# Ensure we set the env var to avoid serving SPA files during tests if needed, though mocking Refiner handles logic
import os
os.environ["REFSCORE_SERVE_DIST"] = "0"

from deepsearch_api import app

@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    return TestClient(app)

@pytest.fixture(autouse=True)
def mock_deepsearch_components(monkeypatch):
    # Mock NLPProcessor
    mock_nlp = MagicMock()
    mock_nlp.refine_query.return_value = "refined query"
    mock_nlp.calculate_similarity.return_value = 0.8
    
    # Mock DocumentRefiner
    mock_refiner = MagicMock()
    
    async def async_refine_document(*args, **kwargs):
        return "Refined document text"
        
    mock_refiner.refine_document = async_refine_document # Mock as async function
    mock_refiner.generate_bibliography_text.return_value = "Bibliography text"
    mock_refiner.generate_bibtex_content.return_value = "@article{...}"
    mock_refiner.view = MagicMock() # Mock the view component

    # Patch the classes in deepsearch_api module directly
    # Note: We need to patch where they are USED, not just where they are defined
    monkeypatch.setattr("deepsearch_api.NLPProcessor", lambda *args, **kwargs: mock_nlp)
    monkeypatch.setattr("deepsearch_api.DocumentRefiner", lambda *args, **kwargs: mock_refiner)
    
    # Also patch get_refiner to return our mock if it's called directly
    # But since the endpoint calls get_refiner, and get_refiner instantiates DocumentRefiner,
    # patching DocumentRefiner class above should work.
    # However, get_refiner is defined in deepsearch_api.py, so we can patch it too for safety.
    def mock_get_refiner(settings=None):
        return mock_refiner
    monkeypatch.setattr("deepsearch_api.get_refiner", mock_get_refiner)
    
    # Patch the global nlp_processor in deepsearch_api
    monkeypatch.setattr("deepsearch_api.nlp_processor", mock_nlp)

