module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'header-max-length': [0, 'always', 255],
        // 'references-empty': [2, 'never'],
        'subject-case': [0, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
        'type-enum': [
			2,
			'always',
			[
				'fix',
				'feat',
				'makeup',
				'style',
				'test',
				'chore',
				'wip',
				'docs',
				'build',
				'ci',
				'perf',
				'refactor',
				'revert',
			],
        ],
    },
    wildcards: {
        merge: ['^(Merge pull request)|(Merge (.*?) into (.*?)|(Merge branch (.*?))$)'],
        revert: ['^revert: (.*)'],
    },
};
