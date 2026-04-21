# Use modelos da Azure OpenAI ou da Microsoft Foundry para revisar solicitacoes de PullRequest dentro do Azure Devops
Task do Azure DevOps que adiciona comentarios em portugues nas solicitacoes de PullRequest com a ajuda da IA.

## Servico Azure OpenAI
Para o parametro 'aoi_endpoint' informar o endpoint como no exemplo: https://{XXXXXXXX}.openai.azure.com/openai/deployments/{MODEL_NAME}/chat/completions?api-version={API_VERSION}

> [Documentacao API REST](https://learn.microsoft.com/pt-br/azure/ai-services/openai/reference).

---

## Servico Microsoft Foundry
- CHAT-COMPLETION - Para o parametro 'aoi_endpoint' de agent NAO criado/construido atraves de deploy do Microsoft Foundry: https://XXXXX.openai.azure.com/openai/v1/chat/completions
- RESPONSES - Para o parametro 'aoi_endpoint' de agent construido atraves de deploy do Microsoft Foundry: https://XXXXXX.services.ai.azure.com/api/projects/XXXXXX/openai/v1/responses

> [Documentacao create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)

## Observar dentro do Microsoft Foundry se o modelo é compatível com o chat-completions e/ou responses
![contribute_to_pr](https://github.com/jpitapeva/extensao-devops-pull-request/blob/main/images/model.png?raw=true)

---

### De permissao ao Agent de servico de build
Antes de usar esta task, certifique-se de que o servico de build tenha permissoes para contribuir em seu REPOSITORIO:

![contribute_to_pr](https://github.com/jpitapeva/extensao-devops-pull-request/blob/main/images/contribute_to_pr.png?raw=true)

### Permitir que a tarefa acesse o token do sistema
Adicione uma secao de checkout com persistCredentials definido como true.

### Release notes
- Versão 27.0.2: corrigimos vulnerabilidades em bibliotecas de terceiros e atualizamos o Node.js da versão 16 para 20.1. ATENCAO: essa mudanca pode exigir ajustes em ambientes que ainda utilizam Node.js 16.
- Versão 28: adicionamos o campo opcional 'build_service_name'. Detalhe: o parametro 'build_service_name' deve ser informado quando houver um build service especifico configurado no repositório do Azure DevOps. Necessario para situacoes em que comentarios antigos dentro do PR e gerado pela IA nao sao excluidos.
- Versão 29: adequamos as novas especificacoes da API da OpenAI: o parametro do body mudou de 'max_tokens' para 'max_completion_tokens', e o valor padrao de 'temperature' mudou de 0 para 1.
- Versão 30: corrigimos instabilidades e incluimos novas validacoes.
- Versão 31: [Breaking changes] passou a ser obrigatorio informar o nome correto do modelo no parametro(model_name), o modelo é configurado no portal do Microsoft Foundry (ex.: gpt-5.4-nano, gpt-35-turbo, gpt-4-32k, gpt-4-0613, gpt-4-32k-0613). Mais detalhes: https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure?tabs=global-standard-aoai%2Cglobal-standard&pivots=azure-openai
- Versão 32: disponibilizamos a integracao com agents do Microsoft Foundry.

---

> [README](https://github.com/jpitapeva/extensao-devops-pull-request/blob/main/README.md)

---

#### Pipelines Yaml
```yaml
jobs:
- job:
  displayName: "JPCompcombr code review"
  pool:
    vmImage: ubuntu-latest 
 
  steps:
  - checkout: self
    persistCredentials: true

  - task: JPCompcombr@32
    displayName: GPTPullRequestReview
    inputs:
      api_key: 'api-key'      
      aoi_endpoint: 'https://{XXXXXXXX}.azure.com/openai/deployments/{MODEL_NAME}/chat/completions?api-version={API_VERSION} OU https://XXXXX.openai.azure.com/openai/v1/chat/completions OU PARA MODO AGENT https://XXXXXX.services.ai.azure.com/api/projects/XXXXXX/openai/v1/responses'
      aoi_tokenMax: 1000
      aoi_temperature: 1
      use_https: true
      prompt: 'Opcional. Agora se desejar voce pode criar o seu proprio prompt, exemplo. Atue como revisor de codigo de uma solicitacao de pull, fornecendo feedback sobre possiveis bugs e problemas de codigo limpo.\nVocê recebe as alteracoes da solicitacao de pull em um formato de patch.\nCada entrada de patch tem a mensagem de confirmacao na linha de assunto, seguida pelas alteracoes de codigo (diffs) em um formato unidiff.\n\nComo revisor de codigo, sua tarefa é:\n- Revisar apenas as linhas adicionadas, editadas ou excluídas.\n- Se não houver bugs e as alteracoes estiverem corretas, escreva apenas 'Sem feedback'.\n- Se houver bugs ou alteracoes de codigo incorretas'
      file_excludes: 'file1.js,file2.py,secret.txt,*.csproj,src/**/*.csproj'      
      additional_prompts: 'Opcional. Prompt adicional separado por virgula, exemplo: corrija a nomenclatura de variaveis, garanta identacao consistente, revise a abordagem de tratamento de erros'
      build_service_name: 'Opcional. O build_service_name é um campo opcional e deve ser informado quando existir um build service especifico configurado dentro do repositorio do Azure Devops. Necessario para situacoes em que comentarios antigos dentro do PR e gerado pela IA nao sao excluidos.'
      model_name: A partir da versão 31 é obrigatorio informar o nome correto do modelo configurado no Microsoft Foundry. Exemplo: gpt-5.4-nano, gpt-35-turbo, gpt-4-32k, gpt-4-0613, gpt-4-32k-0613.
      agent_foundry_mode: 'bool. Informar 'true' se o agent foi construido por deploy dentro do Microsoft Foundry, endpoint por exemplo: https://XXXXXX.services.ai.azure.com/api/projects/XXXXXX/openai/v1/responses'. [default = false]
      agent_name: Obrigatorio informar o nome do correto do agent se o parametro 'agent_foundry_mode' for configurado como true
      agent_version: Obrigatorio informar a versao correta do agent se o parametro 'agent_foundry_mode' for configurado como true
      prompt_view: Opcional. Informe true para habilitar a visualização do prompt. [default = false]
```

---

## License
[MIT](https://raw.githubusercontent.com/mlarhrouch/azure-pipeline-gpt-pr-review/main/LICENSE)

## Site
[JPCOMP](https://jpcomp.com.br/)

## Plus
[Devops Publish](https://learn.microsoft.com/en-us/azure/devops/extend/publish/overview?view=azure-devops)
