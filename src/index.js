import { promises as fs } from "fs";
import core from "@actions/core";
import github from "@actions/github";

import { parse } from "./lcov";
import { diff } from "./comment";
import { upsertComment } from "./github";

async function main() {
	const { context = {} } = github || {};

	const token = core.getInput("github-token");
	const lcovFile = core.getInput("lcov-file") || "./coverage/lcov.info";
	const baseFile = core.getInput("lcov-base");

	const raw = await fs.readFile(lcovFile, "utf-8").catch(err => null);
	if (!raw) {
		console.log(`No coverage report found at '${lcovFile}', exiting...`);
		return;
	}

	const baseRaw =
		baseFile && (await fs.readFile(baseFile, "utf-8").catch(err => null));
	if (baseFile && !baseRaw) {
		console.log(`No coverage report found at '${baseFile}', ignoring...`);
	}

	const options = {
		repository: context.payload.repository.full_name,
		commit: context.payload.pull_request.head.sha,
		prefix: `${process.env.GITHUB_WORKSPACE}/`,
		head: context.payload.pull_request.head.ref,
		base: context.payload.pull_request.base.ref,
	};

	const lcov = await parse(raw);
	const baselcov = baseRaw && (await parse(baseRaw));

	const client = github.getOctokit(token);

	await upsertComment({
		client,
		context,
		prNumber: context.payload.pull_request.number,
		body: diff(lcov, baselcov, options),
	});
}

main().catch(function(err) {
	console.log(err);
	core.setFailed(err.message);
});
