import * as tl from "azure-pipelines-task-lib/task";
import { Configuration, OpenAIApi } from 'openai';
import { deleteExistingComments } from './pr';
import { reviewFile } from './review';
import { consumeApi } from './review';
import { getTargetBranchName } from './utils';
import { getChangedFiles } from './git';
import * as https from 'https';
import * as http from 'http';
import { Repository } from './repository';

async function run() {
  try {
    if (tl.getVariable('Build.Reason') !== 'PullRequest') {
      tl.setResult(tl.TaskResult.Skipped, "Esta tarefa deve ser executada somente quando o build for acionado atraves de uma solicitacao pr.");
      return;
    }

    const _repository = new Repository();
    const pr_1 = require("./pr");
    const reviewTs = require("./review");
    const supportSelfSignedCertificate = tl.getBoolInput('support_self_signed_certificate');
    const apiKey = tl.getInput('api_key', true);
    const aoiEndpoint = tl.getInput('aoi_endpoint', true);
    const tokenMax = tl.getInput('aoi_tokenMax', true);
    const temperature = tl.getInput('aoi_temperature', true);
    const additionalPrompts = tl.getInput('additional_prompts', false)?.split(',')
    const fileExtensions = tl.getInput('file_extensions', false);
    const filesToExclude = tl.getInput('file_excludes', false);
    const openaiModel = tl.getInput('model') || 'gpt-4-32k';
    const useHttps = tl.getBoolInput('use_https', true);

    if (apiKey == undefined) {
      tl.setResult(tl.TaskResult.Failed, 'No Api Key provided!');
      return;
    }

    if (aoiEndpoint == undefined) {
      tl.setResult(tl.TaskResult.Failed, 'No Endpoint AzureOpenAi provided!');
      return;
    }
    
    let Agent: http.Agent | https.Agent;

    if(useHttps) {
      Agent = new https.Agent({rejectUnauthorized: !supportSelfSignedCertificate});
    }
    else
    {
      Agent = new http.Agent();
    }

    let targetBranch = getTargetBranchName();

    if (!targetBranch) {
      tl.setResult(tl.TaskResult.Failed, 'No target branch found!');
      return;
    }

    await deleteExistingComments(Agent);

    console.log('Iniciando Code Review');

    let filesToReview = await _repository.GetChangedFiles(fileExtensions, filesToExclude);
    if (filesToReview.length === 0 || filesToReview.length == 0) {
      console.log(`Nao encontrado codigo passivel de revisao, revise os parametros de entrada da tarefa.`);
      tl.setResult(tl.TaskResult.SucceededWithIssues, "Nao encontrado codigo passivel de revisao, revise os parametros de entrada da tarefa.");
      return
    }

    console.log(`Detectado alteracao em ${filesToReview.length} arquivos`);

    for (let index = 0; index < filesToReview.length; index++) {

      const fileToReview = filesToReview[index];
      let diff = await _repository.GetDiff(fileToReview);
      let review = await reviewFile(diff, fileToReview, Agent, apiKey, aoiEndpoint, tokenMax, temperature, additionalPrompts)

      if (diff.indexOf('NO_COMMENT') < 0) {
        await pr_1.addCommentToPR(fileToReview, review, Agent);
      }

      console.log(`Revisao finalizada do arquivo ${fileToReview}`)
      //gerar um console.log com o cosumo de tokens o consumo esta na variavel consumeApi gerada no arquivo review.ts
      console.log(`----------------------------------`)
      console.log(`Consumo de Tokens: ${consumeApi}`)
      console.log(`----------------------------------`)
    }

    console.log("Task de Pull Request finalizada.");
  }
  catch (err: any) {
    console.log("Encontrado erro", err.message);
    console.log(tl.TaskResult.Failed, err.message);
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();