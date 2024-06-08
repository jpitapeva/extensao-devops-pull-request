import fetch from 'node-fetch';
import { git } from './git';
import { addCommentToPR } from './pr';
import { Agent } from 'https';

export async function reviewFile(gitDiff: string, fileName: string, httpsAgent: Agent, apiKey: string, aoiEndpoint: string, tokenMax: string | undefined, temperature: string | undefined, additionalPrompts: string[] = []) {
  console.log(`Iniciando revisao do arquivo: ${fileName} ...`);

  const instructions = `Sua tarefa é atuar como revisor de código de uma solicitação pull request.
                - Use marcadores se você tiver vários comentários                 
                - Se houver algum bug, destaque.
                - Se houver grandes problemas de desempenho, destaque.                
                - Forneça detalhes sobre o não uso das melhores práticas.
                ${additionalPrompts.length > 0 ? additionalPrompts.map(str => `- ${str}`).join('\n') : null}
                - Forneça apenas instruções para melhorias.                
                - Se não houver bugs e as alterações estiverem corretas, escreva apenas 'Sem feedback'.`;

  try {
    let choices: any;
    if (tokenMax === undefined || tokenMax === '') {
      tokenMax = '100';
      console.log(`tokenMax fora dos parametros, para proseguir com a task foi setado para 100.`);
    }
    if (temperature === undefined || temperature === '' || parseInt(temperature) > 2) {
      temperature = '0';
      console.log(`temperature fora dos parametros, para proseguir com a task foi setada para 0.`);
    }

    try {
      const request = await fetch(aoiEndpoint, {
        method: 'POST',
        headers: { 'api-key': `${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_tokens: parseInt(`${tokenMax}`),
          temperature: parseInt(`${temperature}`),
          messages: [{
            role: "user",
            content: `${instructions}\n, patch : ${gitDiff}}`
          }]
        })
      });

      const response = await request.json();

      choices = response.choices;
    }
    catch (responseError: any) {
      console.log(`Encontrado erro, validar os parametros de entrada. ${responseError.response.status} ${responseError.response.message}`);
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