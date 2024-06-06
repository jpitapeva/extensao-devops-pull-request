import fetch from 'node-fetch';
import { git } from './git';
import { OpenAIApi } from 'openai';
import { addCommentToPR } from './pr';
import { Agent } from 'https';
import * as tl from "azure-pipelines-task-lib/task";

export async function reviewFile(targetBranch: string, fileName: string, httpsAgent: Agent, apiKey: string, openai: OpenAIApi | undefined, aoiEndpoint: string | undefined, tokenMax: string | undefined, temperature: string | undefined, additional_prompts: string | undefined) {
  console.log(`Iniciando revisao ${fileName} ...`);

  const defaultOpenAIModel = 'gpt-3.5-turbo';
  const patch = await git.diff([targetBranch, '--', fileName]);

  const instructions = `Sua tarefa é atuar como revisor de código de uma solicitação pull request.
                - Use marcadores se você tiver vários comentários
                ${additional_prompts ?? null}
                - Se houver algum bug, destaque.
                - Se houver grandes problemas de desempenho, destaque.
                - Forneça detalhes sobre o não uso das melhores práticas.
                - Forneça apenas instruções para melhorias.                
                - Se não houver bugs e as alterações estiverem corretas, escreva apenas 'Sem feedback'.`;

  try {
    let choices: any;
    if (tokenMax === undefined || tokenMax === '') {
      tokenMax = '100';
      console.log(`tokenMax setado para 100.`);
    }
    if (temperature === undefined || temperature === '' || parseInt(temperature) > 2) {
      temperature = '0';
      console.log(`temperature setado para 0.`);
    }
    if (openai) {
      const response = await openai.createChatCompletion({
        model: tl.getInput('model') || defaultOpenAIModel,
        messages: [
          {
            role: "system",
            content: instructions
          },
          {
            role: "user",
            content: patch
          }
        ],
        max_tokens: parseInt(`${tokenMax}`)
      });

      choices = response.data.choices
    }
    else if (aoiEndpoint) {
      try {
        const request = await fetch(aoiEndpoint, {
          method: 'POST',
          headers: { 'api-key': `${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            max_tokens: parseInt(`${tokenMax}`),
            temperature: parseInt(`${temperature}`),
            messages: [{
              role: "user",
              content: `${instructions}\n, patch : ${patch}}`
            }]
          })
        });

        const response = await request.json();

        choices = response.choices;
      }
      catch (responseError: any) {
        console.log(`Encontrado erro, validar os parametros de entrada. ${responseError.response.status} ${responseError.response.message}`);
      }
    }

    if (choices && choices.length > 0) {
      const review = choices[0].message?.content as string;

      if (review.trim() !== "Sem feedback.") {
        await addCommentToPR(fileName, review, httpsAgent);
      }
    }

    console.log(`Revisao ${fileName} completa.`);
  }
  catch (error: any) {
    if (error.response) {
      console.log(error.response.status);
      console.log(error.response.data);
    } else {
      console.log(error.message);
    }
  }
}