dev:
	nr dev

dev-test:
	cd ../klaim-test && nr dev

update-version-deno:
	@echo "Extracting version from package.json..."
	@VERSION=$(shell grep -oP '"version":\s*"\K[^"]+' package.json) && \
	echo "Found version: $$VERSION" && \
	echo "Updating deno.json..." && \
	sed -i.bak 's/"version": "[^"]*"/"version": "'$$VERSION'"/' deno.json && \
	rm deno.json.bak && \
	echo "Update completed successfully!"

# Définissez une variable par défaut pour le type de release
RELEASE_TYPE ?=

# Cible principale
release:
	( \
		eval `ssh-agent -s`; \
		ssh-add ~/.ssh/id_rsa; \
		if [ "$(RELEASE_TYPE)" = "minor" ]; then \
			nr release:minor; \
		elif [ "$(RELEASE_TYPE)" = "major" ]; then \
			nr release:major; \
		else \
			nr release; \
		fi \
	)

# Cibles pour définir le type de release
release:minor:
	$(MAKE) release RELEASE_TYPE=minor

release:major:
	$(MAKE) release RELEASE_TYPE=major

