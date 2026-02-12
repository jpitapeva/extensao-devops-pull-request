import * as tl from "azure-pipelines-task-lib/task";
import { deleteExistingComments, addCommentToPR } from './pr';
import { reviewFile, consumeApi } from './review';
import { getTargetBranchName } from './utils';
import { addAiReviewLabels } from './pr-labels';
import * as https from 'https';
import * as http from 'http';
import { Repository } from './repository';

async function run() {
  try {
    if (tl.getVariable('Build.Reason') !== 'PullRequest') {
      tl.setResult(tl.TaskResult.Skipped, "Esta tarefa deve ser executada somente quando o build for acionado atraves de uma solicitacao pr.");
      return;
    }

    // Validate critical environment variables
    const requiredVars = [
      'SYSTEM.TEAMFOUNDATIONCOLLECTIONURI',
      'SYSTEM.TEAMPROJECTID', 
      'Build.Repository.Name',
      'System.PullRequest.PullRequestId',
      'SYSTEM.ACCESSTOKEN'
    ];
    
    for (const varName of requiredVars) {
      if (!tl.getVariable(varName)) {
        tl.setResult(tl.TaskResult.Failed, `Variavel de ambiente requerida não encontrada: ${varName}. Certifique-se de que 'Allow scripts to access the OAuth token' está habilitado nas configurações do pipeline.`);
        return;
      }
    }

    const _repository = new Repository();
    const supportSelfSignedCertificate = tl.getBoolInput('support_self_signed_certificate');
    const apiKey = tl.getInput('api_key', true);
    const aoiEndpoint = tl.getInput('aoi_endpoint', true);
    const tokenMax = tl.getInput('aoi_tokenMax', true);
    const temperature = tl.getInput('aoi_temperature', true);
    const prompt = tl.getInput('prompt', false);
    const additionalPrompts = tl.getInput('additional_prompts', false)
      ?.split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);
    const fileExtensions = tl.getInput('file_extensions', false);
    const filesToExclude = tl.getInput('file_excludes', false);
    const useHttps = tl.getBoolInput('use_https', true);
    const buildServiceName = tl.getInput('build_service_name', false);

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

    await deleteExistingComments(Agent, buildServiceName);

    console.log('Iniciando Code Review');

    let filesToReview = await _repository.GetChangedFiles(fileExtensions, filesToExclude);
    if (filesToReview.length === 0) {
      console.log(`Nao encontrado codigo passivel de revisao, Sem feedback para revisao de codigo ou revise os parametros de entrada da tarefa.`);
      tl.setResult(tl.TaskResult.SucceededWithIssues, "Nao encontrado codigo passivel de revisao, Sem feedback para revisao de codigo ou revise os parametros de entrada da tarefa.");
      return
    }

    console.log(`Detectado alteracao em ${filesToReview.length} arquivo(s)`);

    const noFeedbackMarker = 'Sem feedback';
    
    for (const element of filesToReview) {

      const fileToReview = element;
      let diff = await _repository.GetDiff(fileToReview);
      
      // Skip files with empty diffs
      if (!diff || diff.trim().length === 0) {
        console.log(`Arquivo ${fileToReview} sem alteracoes no diff, pulando revisao.`);
        continue;
      }

      let review = await reviewFile(diff, fileToReview, Agent, apiKey, aoiEndpoint, tokenMax, temperature, prompt, additionalPrompts)

      if (review && review.trim() !== noFeedbackMarker && !review.startsWith('Erro')) {
        await addCommentToPR(fileToReview, review, Agent);
      } else if (review && review.startsWith('Erro')) {
        console.log(`Erro ao revisar arquivo ${fileToReview}: ${review}`);
      } else {
        console.log(`Sem problemas encontrados no arquivo ${fileToReview}`);
      }

      console.log(`Revisao finalizada do arquivo ${fileToReview}`)
      //gerar um console.log com o cosumo de tokens o consumo esta na variavel consumeApi gerada no arquivo review.ts
      console.log(`----------------------------------`)
      console.log(`Consumo de Tokens: ${consumeApi}`)
      console.log(`----------------------------------`)
    }

    // TODO
    // ADD AI REVIEW LABEL TO PR
    //const prId = tl.getVariable('System.PullRequest.PullRequestId');
    //if (!prId) {
    //  tl.setResult(tl.TaskResult.Failed, 'No Pull Request ID found.');
    //  return;
    //}
    //console.log('Adicionando label de revisão por IA ao PR...');
    //await addAiReviewLabels({ id: Number(prId), labels: [] }, Agent);

    console.log("Task de Pull Request finalizada.");
  }
  catch (err: any) {
    console.log("Encontrado erro", err.message);
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
