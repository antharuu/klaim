// release-it.config.cjs
require('./load-env.cjs');

module.exports = {
    github: {
        release: true,
        tokenRef: 'GITHUB_TOKEN'
    },
    npm: {
        publish: false,
    },
    git: {
        requiredBranch: 'main',
        requireCleanWorkingDir: false,
        commitMessage: 'chore: release v%s'
    },
    hooks: {
        'before:init': [
            'git pull',
            'bun run lint',
            'bun run build'
        ],
        'after:bump': [
            // `npx jsr publish --token ${process.env.JSR_TOKEN} --allow-dirty`
            `npm config set //registry.npmjs.org/:_authToken=${process.env.NPM_TOKEN}`,
            `npm publish`
        ]
    }
};
