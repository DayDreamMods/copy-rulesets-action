const core = require('@actions/core');
const github = require('@actions/github');

(async() => {
    const octokit = github.getOctokit(core.getInput("owner-token"));
    const sourceRepo = core.getInput("source-repo");
    let destRepo = core.getInput("dest-repo");
    if (destRepo.length == 0) 
        destRepo = github.context.payload.repository.full_name;
    const regexFilter = core.getInput("regex-filter");
    const nameFormat = core.getInput("name-format");
    const rulesetEnabled = core.getInput("ruleset-enabled") === 'true';
    const overwrite = core.getInput("overwrite") === 'true';

    core.info(`Copying Rulesets - GitHub Action
    with:
        source-repo: ${sourceRepo}
        dest-repo: ${destRepo}
        regex-filter: ${regexFilter}
        name-format: ${nameFormat}
        ruleset-enabled: ${rulesetEnabled}
        overwrite: ${overwrite}`);

    const [sourceOwner, sourceRepoName] = sourceRepo.split('/');
    const [destOwner, destRepoName] = destRepo.split('/');

    const copyRulesets = await octokit.rest.repos.getRepoRulesets({
        owner: sourceOwner, repo: sourceRepoName
    });

    const curRulesets = await octokit.rest.repos.getRepoRulesets({
        owner: destOwner, repo: destRepoName
    });

    for (const rulesetRef of copyRulesets.data) {
        if (rulesetRef.name.match(regexFilter) === null) continue;
        var isOn = rulesetEnabled;
        const newName = nameFormat.replace("${name}", rulesetRef.name);

        const fullRuleset = await octokit.rest.repos.getRepoRuleset({
            owner: sourceOwner, repo: sourceRepoName, ruleset_id: rulesetRef.id
        });

        const existingIdx = curRulesets.data.findIndex(rs => rs.name == newName);
        if (existingIdx >= 0 && !overwrite) continue;
        if (existingIdx >= 0) {
            const existing = curRulesets.data[existingIdx];
            isOn = existing.enforcement == 'active';
            core.warning(`Overwriting ruleset ${existing.name}...`)
            await octokit.rest.repos.deleteRepoRuleset({
                owner: destOwner, repo: destRepoName, ruleset_id: existing.id
            });
        }

        core.info(`Created ruleset ${newName} @ ${destRepo}`)
        await octokit.rest.repos.createRepoRuleset({
            owner: destOwner, repo: destRepoName,
            name: newName,
            enforcement: isOn ? 'active' : 'disabled',
            bypass_actors: fullRuleset.data.bypass_actors,
            rules: fullRuleset.data.rules,
            conditions: fullRuleset.data.conditions
        });
    }
})();