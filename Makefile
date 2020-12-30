.PHONY: deps

run: deps
	git submodule update --init --remote
	cd space/server && go run ./main -static ../../static/

deps: \
	static/deps/SubdivisionModifier.js \
	static/deps/three/build/three.module.js \
	static/deps/three/examples/jsm/loaders/GLTFLoader.js \
	static/deps/three/examples/jsm/utils/BufferGeometryUtils.js \
	static/deps/three/examples/jsm/modifiers/SubdivisionModifier.js \
	static/deps/three/examples/jsm/postprocessing/UnrealBloomPass.js \

static/deps/SubdivisionModifier.js:
	mkdir -p "$(dir $@)"
	curl -Lo $@ "https://gist.githubusercontent.com/jackrugile/b40a07d6f6b5bc202b9d587aee14ce01/raw/6ebe7acd9d6852d247e751173dc1a1e834074aac/SubdivisionModifier.js"

static/deps/three/%:
	mkdir -p "$(dir $@)"
	curl -Lo $@ "https://github.com/mrdoob/three.js/raw/master/$*"
