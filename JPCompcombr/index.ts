import * as tl from "azure-pipelines-task-lib/task";
import { Configuration, OpenAIApi } from 'openai';
import { deleteExistingComments } from './pr';
import { reviewFile } from './review';
import { getTargetBranchName } from './utils';
import { getChangedFiles } from './git';
import https from 'https';
import { Repository } from './repository';

async function run() {
  try {
    if (tl.getVariable('Build.Reason') !== 'PullRequest') {
      tl.setResult(tl.TaskResult.Skipped, "Esta tarefa deve ser executada somente quando o build for acionado atraves de uma solicitacao pr.");
      return;
    }

    const _repository = new Repository();
    const pr_1 = require("./pr");
    const supportSelfSignedCertificate = tl.getBoolInput('support_self_signed_certificate');
    const apiKey = tl.getInput('api_key', true);
    const aoiEndpoint = tl.getInput('aoi_endpoint', true);
    const tokenMax = tl.getInput('aoi_tokenMax', true);
    const temperature = tl.getInput('aoi_temperature', true);
    const additionalPrompts = tl.getInput('additional_prompts', false)?.split(',')
    const fileExtensions = tl.getInput('file_extensions', false);
    const filesToExclude = tl.getInput('file_excludes', false);

    if (apiKey == undefined) {
      tl.setResult(tl.TaskResult.Failed, 'No Api Key provided!');
      return;
    }

    if (aoiEndpoint == undefined) {
      tl.setResult(tl.TaskResult.Failed, 'No Endpoint AzureOpenAi provided!');
      return;
    }
    const httpsAgent = new https.Agent({
      rejectUnauthorized: !supportSelfSignedCertificate
    });

    let targetBranch = getTargetBranchName();

    if (!targetBranch) {
      tl.setResult(tl.TaskResult.Failed, 'No target branch found!');
      return;
    }

    await deleteExistingComments(httpsAgent);

    let filesToReview = await _repository.GetChangedFiles(fileExtensions, filesToExclude);

    tl.setProgress(0, 'Code Review');

    for (let index = 0; index < filesToReview.length; index++) {
      
      if (filesToReview.length === 0) {
        console.info(`Nao encontrado codigo passivel de revisao, revise os parametros de entrada da tarefa.`)
        tl.setResult(tl.TaskResult.SucceededWithIssues, "Nao encontrado codigo passivel de revisao, revise os parametros de entrada da tarefa.");
        return
      }
      
      const fileToReview = filesToReview[index];
      let diff = await _repository.GetDiff(fileToReview);
      let review = await reviewFile(diff, fileToReview, httpsAgent, apiKey, aoiEndpoint, tokenMax, temperature, additionalPrompts)

      if (diff.indexOf('NO_COMMENT') < 0) {
        await pr_1.addCommentToPR(fileToReview, review, httpsAgent);
      }

      console.info(`Completed review of file ${fileToReview}`)
      tl.setProgress((fileToReview.length / 100) * index, 'Code Review');
    }

    tl.setResult(tl.TaskResult.Succeeded, "Pull Request revisado.");
  }
  catch (err: any) {
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();