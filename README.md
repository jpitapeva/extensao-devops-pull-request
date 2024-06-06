# Use o modelo OpenAI GPT para revisar solicitações pull para Azure Devops
Uma task do Azure DevOps que adicionar comentários no PR com ajuda do GPT.

## Instalação
A instalação pode ser feita usando o [Visual Studio MarketPlace](https://marketplace.visualstudio.com/publishers/jpcompcombr).

## Uso
Adicione as tarefas à sua definição de build.

## Setup
## Serviço Azure Open AI
Endpoint é o seguinte: https://{XXXXXXXX}.openai.azure.com/openai/deployments/{MODEL_NAME}/chat/completions?api-version={API_VERSION}

### Dê permissão ao agente de serviço de construção
Antes de usar esta tarefa, certifique-se de que o serviço de compilação tenha permissões para contribuir com solicitações pull em seu repositório:

![contribute_to_pr](https://github.com/jpitapeva/extensao-devops-pull-request/blob/main/images/contribute_to_pr.png?raw=true)

### Permitir que a tarefa acesse o token do sistema
#### Pipelines Yaml
Adicione uma seção de checkout com persistCredentials definido como true.

```yaml
jobs:
- job:
  displayName: "JPCompcombr code review"
  pool:
    vmImage: ubuntu-latest 
 
  steps:
  - checkout: self
    persistCredentials: true

  - task: JPCompcombr@6
    displayName: GPTPullRequestReview
    inputs:
      api_key: 'YOUR_TOKEN'
      model: 'gpt-4'
      aoi_endpoint: 'https://{XXXXXXXX}.azure.com/openai/deployments/{MODEL_NAME}/chat/completions?api-version={API_VERSION}'
      aoi_tokenMax: 1000
      aoi_temperature: 0
```

## License
[MIT](https://raw.githubusercontent.com/mlarhrouch/azure-pipeline-gpt-pr-review/main/LICENSE)

## Plus
[Devops Publish](https://learn.microsoft.com/en-us/azure/devops/extend/publish/overview?view=azure-devops)
