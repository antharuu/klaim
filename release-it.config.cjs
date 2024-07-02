// release-it.config.cjs
require('./load-env.cjs');

module.exports = {
    github: {
        release: true,
    },
    npm: {
        publish: false,
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
        release: false
    },
    hooks: {
        'before:init': [
            'git pull',
            'bun run lint',
            'bun run build'
        ],
        'after:bump': [
            // `npx jsr publish --token ${process.env.JSR_TOKEN} --allow-dirty`,
            // `npm config set //registry.npmjs.org/:_authToken=${process.env.NPM_TOKEN}`,
            // `npm publish`,
            `git config --global user.email "antho.eclips@gmail.com"`,
            `git config --global user.name "Anthony Bellancourt"`,
        ]
    }
};
