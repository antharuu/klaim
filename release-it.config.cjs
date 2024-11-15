// release-it.config.cjs
require('./load-env.cjs');

module.exports = {
    github: {
        release: false,
    },
    npm: {
        publish: true,
    },
    git: {
        tagName: "v${version}",
        requiredBranch: 'main',
        requireCleanWorkingDir: false,
        commitMessage: "chore: release v${version}",
        tag: true,
        push: true,
        commit: true,
        publish: true,
    },
    hooks: {
        'before:init': [
            'git pull',
            'npm run build'
        ],
        'after:bump': [
            'make update-version-deno',
            'npx jsr publish --allow-dirty'
        ]
    }
};
