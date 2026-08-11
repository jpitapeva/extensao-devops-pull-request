import * as tl from "azure-pipelines-task-lib/task";
import { deleteExistingComments, addCommentToPR, CommentThreadContextInput } from './pr';
import { reviewFile, consumeApi, model, promptInstructions, parseReviewFeedback } from './review';
import { getTargetBranchName } from './utils';
import { addAiReviewLabels } from './pr-labels';
import * as https from 'https';
import * as http from 'http';
import { Repository } from './repository';

interface ReviewOptions {
  agent: http.Agent | https.Agent;
  apiKey: string;
  aoiEndpoint: string;
  tokenMax: string | undefined;
  temperature: string | undefined;
  prompt: string | undefined;
  additionalPrompts: string[] | undefined;
  model_name: string | undefined;
  agent_foundry_mode: boolean | undefined;
  agent_name: string | undefined;
  agent_version: string | undefined;
  authorization_token_entra_id: boolean | undefined;
}

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
    const model_name = tl.getInput('model_name', true);
    const agent_foundry_mode = tl.getBoolInput('agent_foundry_mode', true);
    const agent_name = tl.getInput('agent_name', false);
    const agent_version = tl.getInput('agent_version', false);
    const prompt_view = tl.getBoolInput('prompt_view', true);
    const authorization_token_entra_id = tl.getBoolInput('authorization_token_entra_id', true);
    const groupFiles = tl.getBoolInput('group_files', false) ?? true;

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

    const reviewOptions: ReviewOptions = {
      agent: Agent,
      apiKey,
      aoiEndpoint,
      tokenMax,
      temperature,
      prompt,
      additionalPrompts,
      model_name,
      agent_foundry_mode,
      agent_name,
      agent_version,
      authorization_token_entra_id
    };

    if (groupFiles) {
      await processGroupedReview(_repository, filesToReview, reviewOptions);
    } else {
      await processLegacyReview(_repository, filesToReview, reviewOptions);
    }

    if(agent_foundry_mode){
      console.log(`Parametros do modelo utilizado: ${model}`);
      console.log(`----------------------------------`);
    }

    if(prompt_view){
      console.log(`Prompt: ${promptInstructions}`);
    }

    // ADD AI REVIEW LABEL TO PR
    const prId = tl.getVariable('System.PullRequest.PullRequestId');
    console.log('Adicionando label de revisão por IA ao PR...');
    await addAiReviewLabels(prId, Agent);

    console.log("Task de Pull Request finalizada.");
  }

  catch (err: any) {
    console.log("Encontrado erro", err.message);
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

async function processGroupedReview(
  repository: Repository,
  filesToReview: string[],
  options: ReviewOptions
): Promise<void> {
  console.log('Modo de revisão com arquivos agrupados habilitado.');

  const diffParts = await collectGroupedDiffs(repository, filesToReview);
  if (diffParts.length === 0) {
    console.log('Nenhuma alteracao nos diffs dos arquivos para revisar.');
    return;
  }

  const combinedDiff = diffParts.join('\n\n');
  console.log(`Enviando diffs agrupados de ${diffParts.length} arquivo(s) para o modelo...`);

  const reviewRaw = await reviewFile(
    combinedDiff,
    'Grouped PR Review',
    options.agent,
    options.apiKey,
    options.aoiEndpoint,
    options.tokenMax,
    options.temperature,
    options.prompt,
    options.additionalPrompts,
    options.model_name,
    options.agent_foundry_mode,
    options.agent_name,
    options.agent_version,
    options.authorization_token_entra_id
  );

  await publishReviewFeedbacks(reviewRaw, options.agent);

  console.log(`----------------------------------`);
  console.log(`Consumo de Tokens: ${consumeApi}`);
  console.log(`----------------------------------`);
}

async function collectGroupedDiffs(
  repository: Repository,
  filesToReview: string[]
): Promise<string[]> {
  const diffParts: string[] = [];

  for (const fileToReview of filesToReview) {
    const diff = await repository.GetDiff(fileToReview);
    if (diff && diff.trim().length > 0) {
      diffParts.push(`=== Arquivo: ${fileToReview} ===\n${diff}`);
    } else {
      console.log(`Arquivo ${fileToReview} sem alteracoes no diff, pulando.`);
    }
  }

  return diffParts;
}

async function processLegacyReview(
  repository: Repository,
  filesToReview: string[],
  options: ReviewOptions
): Promise<void> {
  console.log('Modo de revisão arquivo por arquivo (legado) habilitado.');

  for (const fileToReview of filesToReview) {
    const diff = await repository.GetDiff(fileToReview);
    if (!diff || diff.trim().length === 0) {
      console.log(`Arquivo ${fileToReview} sem alteracoes no diff, pulando revisao.`);
      continue;
    }

    const reviewRaw = await reviewFile(
      diff,
      fileToReview,
      options.agent,
      options.apiKey,
      options.aoiEndpoint,
      options.tokenMax,
      options.temperature,
      options.prompt,
      options.additionalPrompts,
      options.model_name,
      options.agent_foundry_mode,
      options.agent_name,
      options.agent_version,
      options.authorization_token_entra_id
    );

    await publishReviewFeedbacks(reviewRaw, options.agent, fileToReview);

    console.log(`Revisao finalizada do arquivo ${fileToReview}`);
    console.log(`----------------------------------`);
    console.log(`Consumo de Tokens: ${consumeApi}`);
    console.log(`----------------------------------`);
  }
}

async function publishReviewFeedbacks(
  reviewRaw: string,
  agent: http.Agent | https.Agent,
  defaultFilePath?: string
): Promise<void> {
  if (!reviewRaw) {
    console.log('Sem resposta gerada para a revisão.');
    return;
  }

  if (reviewRaw.startsWith('Erro')) {
    console.log(`Erro na revisão: ${reviewRaw}`);
    return;
  }

  const feedbackItems = parseReviewFeedback(reviewRaw, defaultFilePath);
  if (feedbackItems.length === 0) {
    console.log('Sem problemas encontrados nos arquivos revisados.');
    return;
  }

  for (const item of feedbackItems) {
    const linesInfo = item.startLine ? ` (linhas: ${item.startLine}-${item.endLine || item.startLine})` : '';
    console.log(`Adicionando comentário na PR para arquivo: ${item.filePath}${linesInfo}`);
    await addCommentToPR(item, item.comment, agent);
  }
}

run();
