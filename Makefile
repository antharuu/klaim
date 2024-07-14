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

.PHONY: release release-minor release-major

release:
	( \
		eval `ssh-agent -s`; \
		ssh-add ~/.ssh/id_rsa; \
		nr release; \
	)

release-minor:
	( \
		eval `ssh-agent -s`; \
		ssh-add ~/.ssh/id_rsa; \
		nr release:minor; \
	)

release-major:
	( \
		eval `ssh-agent -s`; \
		ssh-add ~/.ssh/id_rsa; \
		nr release:major; \
	)


