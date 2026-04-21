import fetch from 'node-fetch';
import * as https from 'https';
import * as http from 'http';

export let consumeApi: string = 'Usage: Informação não disponível';
export let model: string = '';

export async function reviewFile(
  gitDiff: string,
  fileName: string,
  agent: http.Agent | https.Agent,
  apiKey: string,
  aoiEndpoint: string,
  tokenMax: string | undefined,
  temperature: string | undefined,
  prompt: string | undefined,
  additionalPrompts: string[] = [],
  model_name: string | undefined,
  agent_foundry_mode: boolean | undefined,
  agent_name: string | undefined,
  agent_version: string | undefined
): Promise<string> {
  console.log(`Iniciando revisao do arquivo: ${fileName} ...`);

  let instructions: string;
  const noFeedbackMarker = 'Sem feedback';

  if (prompt === null || prompt === '' || prompt === undefined) {
    instructions = `Você é um assistente especializado em engenharia de software, atuando como revisor de código para Pull Requests (PRs).

          ## Objetivo Principal
          Sua missão é analisar as alterações de código fornecidas e fornecer feedback construtivo para **melhorar a saúde geral do código**, garantindo qualidade, manutenibilidade, performance e segurança. O feedback deve ser técnico, didático, focado no código (não no autor) e explicar claramente o *raciocínio* por trás de cada ponto levantado. Priorize a identificação de problemas que realmente impactam a qualidade e a funcionalidade, diferenciando entre problemas críticos e sugestões menores (nits).

          ## Formato de Entrada
          Você receberá as alterações do PR em formato de patch. Cada entrada contém a mensagem de commit seguida pelas alterações de código (diffs) em formato unidiff.

          ## Instruções Detalhadas para Revisão
          Analise o código fornecido com base nos seguintes critérios. Para cada ponto levantado, explique o problema e, sempre que possível, sugira uma solução ou alternativa clara e acionável.

          ### 1. Design e Arquitetura
          - A solução está bem desenhada e se integra adequadamente ao sistema existente?
          - A arquitetura da mudança é sólida e segue princípios como SOLID?
          - Evita complexidade desnecessária ou *over-engineering* (funcionalidades não solicitadas)?
          - Considera a manutenibilidade e extensibilidade futuras?

          ### 2. Funcionalidade e Correção
          - Identifique possíveis bugs, erros lógicos ou comportamentos inesperados.
          - Verifique se todos os casos de borda relevantes foram considerados e tratados.
          - A funcionalidade implementada corresponde ao propósito original da tarefa/issue?

          ### 3. Legibilidade e Manutenibilidade (Código Limpo)
          - O código segue as boas práticas de código limpo? É fácil de ler, entender e modificar?
          - A nomenclatura (variáveis, funções, classes, etc.) é clara, significativa, consistente e segue as convenções estabelecidas?
          - Os comentários são úteis, claros e explicam o *porquê* (a intenção) em vez do *o quê* (que o código já diz)? Evita comentários redundantes ou desatualizados?
          - Há duplicação de código que pode ser refatorada para um componente reutilizável?

          ### 4. Performance
          - As alterações podem introduzir gargalos ou impactar negativamente o desempenho (latência, uso de CPU/memória)?
          - Existem oportunidades claras e significativas para otimização de desempenho (escolha de algoritmos/estruturas de dados, otimização de queries, redução de I/O)? Sugira otimizações específicas e justifique-as.

          ### 5. Segurança
          - Identifique vulnerabilidades conhecidas ou potenciais introduzidas pela mudança (e.g., SQL Injection, XSS, tratamento inadequado de dados sensíveis).
          - As melhores práticas de segurança estão sendo seguidas (validação de entrada, sanitização de dados, controle de acesso, tratamento seguro de erros)?

          ### 6. Testes
          - (Se informações sobre testes estiverem disponíveis ou puderem ser inferidas do contexto ou código) Os testes automatizados (unitários, integração, etc.) são adequados, cobrem as novas funcionalidades.
          - Os testes são bem escritos, legíveis e fáceis de manter?

          ### 7. Documentação
          - (Se aplicável e informações disponíveis) A documentação relevante (READMEs, comentários de documentação de API/funções, etc.) foi adicionada ou atualizada para refletir as mudanças no código?

          ## Instruções Adicionais Específicas
          ${additionalPrompts && additionalPrompts.length > 0 ? additionalPrompts
        .map((str) => `- ${str.trim()}`)
        .filter(Boolean)
        .join('\n')
        : null
          }`
      
      instructions = `${instructions}, ${tratamentoDeSaida(noFeedbackMarker)}`;

      console.log(`${instructions}`);
  }   
  else {
    // Append no-feedback instruction to custom prompt to ensure consistent behavior
    instructions = `${prompt}, ${tratamentoDeSaida(noFeedbackMarker)}`;
  }

  try {
    let choices: any;
    let responseOpenAi: any = { usage: undefined }; // Initialize to avoid undefined in token capture
    let responseFoundry: any = { usage: undefined }; // Initialize to avoid undefined in token capture

    if (agent_foundry_mode === true && (agent_name === undefined || agent_name === '' || agent_version === undefined || agent_version === '')) {
      console.log(`ATENCAO: No agent_foundry_mode fica obrigatorio informar os parametros corretos do agent_name e agent_version.`);
      console.log('##vso[task.complete result=Failed;]');
      return 'Erro: parametros de entrada inválidos';
    }
    if (tokenMax === undefined || tokenMax === '') {
      tokenMax = '100';
      console.log(`tokenMax fora dos parametros, para proseguir com a task foi setado para 100.`);
    }
    if (temperature === undefined || temperature === '') {
      temperature = '1';
      console.log(`temperatura fora dos parametros, para proseguir, a task foi setada para 1.`);
    }
    if (model_name === undefined || model_name === '') {
      console.log(`ATENCAO: A partir da versão 31 e obrigatorio informar o nome correto do modelo configurado no Microsoft Foundry parametro de entrada = 'model_name'. Exemplo de modelos: gpt-5.4-nano, gpt-35-turbo, gpt-4-32k, gpt-4-0613, gpt-4-32k-0613, gpt-4-1106-preview, gpt-4-1106, etc. Verificar a documentação para mais detalhes: https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure?tabs=global-standard-aoai%2Cglobal-standard&pivots=azure-openai`);
      console.log('##vso[task.complete result=Failed;]');
      return 'Erro: parametros de entrada inválidos';
    }

    // Validate temperature is a valid number between 0 and 2
    const tempValue = parseFloat(temperature);
    if (isNaN(tempValue) || tempValue < 0 || tempValue > 2) {
      temperature = '1';
      console.log(`temperatura invalida, para proseguir, a task foi setada para 1.`);
    }

    if (agent_foundry_mode === false || agent_foundry_mode === undefined) {
      try {
        console.log(`Executando requisição para Azure OpenAI ou Foundry NAO integrado com agent...`);
        const request = await fetch(aoiEndpoint, {
          method: 'POST',
          headers: { 'api-key': `${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model_name,
            max_completion_tokens: parseInt(`${tokenMax}`),
            temperature: parseFloat(`${temperature}`),
            messages: [
              {
                role: 'system',
                content: 'Você é um assistente especializado em engenharia de software, atuando como revisor de código para Pull Requests (PRs)'
              },
              {
                role: 'user',
                content: `${instructions}\n, patch : ${gitDiff}`
              },
            ],
          }),
          agent: agent
        });

        responseOpenAi = await request.json();

        if (!request.ok || !responseOpenAi || typeof responseOpenAi !== 'object' || !responseOpenAi.choices) {
          console.log(`Resposta bruta da Foundry: ${JSON.stringify(responseOpenAi)}`);
          console.log(`HTTP Status: ${request.status} - ${request.statusText}`);
          console.log(`Encontrado erro, validar os parametros de entrada. CODE: ${responseOpenAi?.error?.code}  MESSAGE: ${responseOpenAi?.error?.message} TYPE: ${responseOpenAi?.error?.type} PARAM: ${responseOpenAi?.error?.param}`);
          console.log('##vso[task.complete result=Failed;]');
          return 'Erro: resposta invalida da API, verificar todos os parametros de entrada como nome do modelo, token, link e a configuração do Azure OpenAI ou Microsoft Foundry.';
        }

        choices = responseOpenAi.choices;
      } catch (responseError: any) {
        console.log(`Resposta bruta da Foundry: ${JSON.stringify(responseError.response)}`);
        console.log(`Encontrado erro, validar os parametros de entrada. CODE: ${responseError.response?.error?.code}  MESSAGE: ${responseError.response?.error?.message} TYPE: ${responseError.response?.error?.type} PARAM: ${responseError.response?.error?.param}`);
        console.log(`Erro completo: ${responseError.message}`);
        console.log('##vso[task.complete result=Failed;]');
        return 'Erro ao comunicar com Azure OpenAI, verificar todos os parametros de entrada e a configuração do Azure OpenAI ou Microsoft Foundry.';
      }

      // Captura o consumo de tokens
      try {
        const completion_tokens_total = responseOpenAi.usage?.completion_tokens ?? responseOpenAi.usage?.completionTokens ?? 0;
        const prompt_tokens_total = responseOpenAi.usage?.prompt_tokens ?? responseOpenAi.usage?.promptTokens ?? 0;
        const total_tokens_total = responseOpenAi.usage?.total_tokens ?? responseOpenAi.usage?.totalTokens ?? 0;

        consumeApi = `Usage: Completions: ${completion_tokens_total}, Prompts: ${prompt_tokens_total}, Total: ${total_tokens_total}`;
      } catch (error: any) {
        console.log(`Erro ao tentar capturar consumo de tokens: ${error.message}`);
        consumeApi = `Usage: Informação indisponivel`;
        console.log('##vso[task.complete result=Failed;]');
      }

      if (choices && choices.length > 0) {
        const reviewOK = choices[0].message?.content;

        // Validate that content exists and is not empty
        if (!reviewOK || typeof reviewOK !== 'string' || reviewOK.trim().length === 0) {
          console.log(`Resposta vazia ou invalida do Azure OpenAI para arquivo ${fileName}.`);
          return noFeedbackMarker;
        }

        console.log(`Revisão do arquivo ${fileName} concluída.`);
        return reviewOK;
      } else {
        console.log(`Nenhum feedback encontrado para o arquivo ${fileName}.`);
        return noFeedbackMarker;
      }
    }
    else {
      try {
        console.log(`Executando requisição para Microsoft Foundry INTEGRADO com Agent...`);
        const requestFoundry = await fetch(aoiEndpoint, {
          method: 'POST',
          headers: { 'api-key': `${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model_name,
            max_output_tokens: parseInt(`${tokenMax}`),
            agent_reference:
            {
              name: agent_name,
              version: agent_version,
              type: 'agent_reference'
            },
            input: [
              {
                role: 'system',
                content: 'Você é um assistente especializado em engenharia de software, atuando como revisor de código para Pull Requests (PRs)'
              },
              {
                role: 'system',
                content: `${instructions}\n, patch : ${gitDiff}`
              },
            ],
          }),
          agent: agent
        });

        responseFoundry = await requestFoundry.json();
        if (!requestFoundry.ok || !responseFoundry || typeof responseFoundry !== 'object') {
          console.log(`HTTP Status: ${requestFoundry.status} - ${requestFoundry.statusText}`);
          console.log(`Encontrado erro, validar os parametros de entrada. CODE: ${responseFoundry?.error?.code}  MESSAGE: ${responseFoundry?.error?.message} TYPE: ${responseFoundry?.error?.type} PARAM: ${responseFoundry?.error?.param}`);
          console.log(`Request bruta da Foundry: ${JSON.stringify(requestFoundry.body)}`);
          console.log(`Resposta bruta da Foundry: ${JSON.stringify(responseFoundry)}`);
          console.log('##vso[task.complete result=Failed;]');
          return 'Erro: resposta invalida da API, verificar todos os parametros de entrada como nome do modelo, token, link e a configuracao do Azure OpenAI ou Microsoft Foundry.';
        }
      } catch (responseError: any) {
        console.log(`Resposta bruta da Foundry: ${JSON.stringify(responseFoundry)}`);
        console.log('##vso[task.complete result=Failed;]');
        return 'Erro ao comunicar com Microsoft Foundry, verificar todos os parametros de entrada e a configuracao do Azure OpenAI ou Microsoft Foundry.';
      }

      // Captura o consumo de tokens
      try {
        const output_tokens = responseFoundry.usage?.output_tokens ?? responseFoundry.usage?.output_tokens ?? 0; // Adjusted for potential differences in usage reporting
        const input_tokens = responseFoundry.usage?.input_tokens ?? responseFoundry.usage?.input_tokens ?? 0;
        const total_tokens = responseFoundry.usage?.total_tokens ?? responseFoundry.usage?.total_tokens ?? 0;

        consumeApi = `Usage: Input: ${input_tokens}, Output: ${output_tokens}, Total: ${total_tokens}`;
        model = `AGENT PARAMETRIZADO: type - ${responseFoundry?.agent_reference?.type}, name - ${responseFoundry?.agent_reference?.name}, version - ${responseFoundry?.agent_reference?.version}`;

      } catch (error: any) {
        console.log(`Erro ao tentar capturar consumo de tokens: ${error.message}`);
        consumeApi = `Usage: Informação indisponível`;
        console.log('##vso[task.complete result=Failed;]');
      }

      const messageContent = getOutputTextFromResponseOutput(responseFoundry?.output);
      if (messageContent && messageContent.trim().length > 0) {
        const reviewOK = messageContent.trim();
        console.log(`Revisão do arquivo ${fileName} concluída.`);
        return reviewOK;
      }

      console.log(`Nenhum feedback encontrado para o arquivo ${fileName}.`);
      return noFeedbackMarker;
    }
  } catch (error: any) {
    if (error.response) {
      console.log(error.response.status);
      console.log(error.response.data);
      console.log('##vso[task.complete result=Failed;]');
    } else {
      console.log(error.message);
      console.log('##vso[task.complete result=Failed;]');
    }
    return 'Erro ao processar revisão';
  }
}

function getOutputTextFromResponseOutput(output: any): string | undefined {
  if (!Array.isArray(output)) {
    return undefined;
  }

  const messageItem = output.find((item: any) => item?.type === 'message');
  if (!messageItem || !Array.isArray(messageItem.content)) {
    return undefined;
  }

  const outputTextItem = messageItem.content.find((contentItem: any) => contentItem?.type === 'output_text');
  const text = outputTextItem?.text;

  return typeof text === 'string' ? text : undefined;
}

function tratamentoDeSaida(noFeedbackMarker: string): string {
  return ` REGRAS DE COMPORTAMENTO (RESTRIÇÕES RÍGIDAS):
    - NÃO forneça elogios, feedback positivo, encorajamento ou comentários educados.
    - NÃO faça comentários se não houver problemas reais ou melhorias estritamente necessárias.
    - O silêncio é preferível a feedback desnecessário.
    - Comentários gentis ou neutros são considerados ruído de processo.

    CRITÉRIOS DE REVISÃO (COMENTAR APENAS SE PELO MENOS UM FALHAR):
    - Bugs ou erros lógicos
    - Vulnerabilidades de segurança
    - Problemas de performance
    - Violações de padrões de código ou boas práticas
    - Problemas de manutenibilidade ou legibilidade com impacto concreto
    - Testes ausentes, incorretos ou insuficientes (quando aplicável)

    REGRAS DE SAÍDA (EXTREMAMENTE IMPORTANTE):
    - Se, e SOMENTE SE, pelo menos um problema ou ponto de melhoria for identificado, descreva o problema de forma clara, objetiva e técnica.
    - Se NENHUM problema ou melhoria for identificado em TODOS os critérios acima, responda EXATAMENTE com o texto: "${noFeedbackMarker}"
    - Qualquer saída diferente de "${noFeedbackMarker}" será interpretada como um feedback técnico obrigatório para o desenvolvedor, indicando que há algo que precisa ser corrigido ou melhorado.

    REGRA DE IMPACTO NO PROCESSO (NÍVEL AVANÇADO):
    - Qualquer saída diferente de "${noFeedbackMarker}" será interpretada como uma ação obrigatória para o desenvolvedor.
    - Feedback desnecessário causa atrito no processo de Pull Request e DEVE ser evitado.

    ANTI-EXEMPLOS (NÃO FAÇA ISSO):
    - "Boa abordagem"
    - "Código bem escrito"
    - "Implementação interessante"
    - "No geral está tudo certo"
    - Qualquer forma de elogio, aprovação implícita ou comentário neutro

    EXEMPLO POSITIVO:
    Entrada: Código sem bugs, sem problemas de segurança e sem pontos de melhoria
    Saída: "${noFeedbackMarker}"`;
}
