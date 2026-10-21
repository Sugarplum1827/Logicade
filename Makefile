# Windows PowerShell users: `make` may not be installed. See README for
# the equivalent one-liner for each target.

.PHONY: ... fallbacks fallbacks-check test-ollama

fallbacks:
	python scripts/generate_fallbacks.py

fallbacks-check:
	python scripts/generate_fallbacks.py --check

help:
	@echo "install          pip install -r requirements.txt"
	@echo "test             pytest (Phase 1 core tests)"
	@echo "test-ollama      pytest -m ollama (Phase 3; requires local Ollama)"
	@echo "test-integration pytest -m integration (Phase 6; requires local Supabase + DEMO_INTEGRATION=1)"
	@echo "model-info       print qwen2.5:3b tag + digest (§2.1)"
	@echo "demo             python demo.py"
	@echo "serve            uvicorn server.main:app --reload"
	@echo "ingest-assets    extract vendor/kenney/*.zip -> vendor/kenney/extracted/ + manifest.json"
	@echo "build-registry   rewrite data/registry.json from manifest (dry-run: python scripts/build_registry.py --dry-run)"
	@echo "assets           ingest-assets + build-registry, chained"
	@echo "fallbacks        generate data/fallback_templates/*.json"
	@echo "fallbacks-check  verify fallbacks have not drifted from the generator"

install:
	python -m pip install -r requirements.txt

ingest-assets:
	python scripts/ingest_kenney.py

build-registry:
	python scripts/build_registry.py

assets: ingest-assets build-registry

test:
	pytest -v

test-ollama:
	pytest -v -m ollama

test-integration:
	DEMO_INTEGRATION=1 pytest -v -m integration

model-info:
	python scripts/model_info.py

demo:
	python demo.py

serve:
	uvicorn server.main:app --reload --port 8000