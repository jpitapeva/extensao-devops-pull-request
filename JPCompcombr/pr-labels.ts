// pr-labels.ts
import * as tl from "azure-pipelines-task-lib/task";
import * as https from 'https';
import * as http from 'http';
import fetch from 'node-fetch';

interface Label {
    name: string;
}

interface PullRequest {
    id: string;
    labels?: Label[];
}

import * as http from 'http';
import * as https from 'https';

type PullRequest = {
    id: number;
    labels: { name: string }[];
};

// Function to check if the label already exists in a pull request
async function labelExists(pullRequest: PullRequest, label: string): Promise<boolean> {
    return pullRequest.labels ? pullRequest.labels.some((existingLabel: Label) => existingLabel.name === label) : false;
}

// Function to label pull requests with AI code review labels
export async function addAiReviewLabels(prId: string | undefined, agent: http.Agent | https.Agent): Promise<void> {
    if (!prId) {
        console.log('ID do Pull Request não disponível. Pulando adição de label.');
        return;
    }

    const aiLabel = 'AI-Reviewed';
    
    try {
        await addLabelToPullRequest(prId, aiLabel, agent);
    } catch (error: any) {
        console.log(`Erro ao adicionar label ao PR: ${error.message}`);
    }
}

// Function to add a label to a pull request via Azure DevOps API
async function addLabelToPullRequest(prId: string, label: string, agent: http.Agent | https.Agent): Promise<void> {
    const labelUrl = `${tl.getVariable('SYSTEM.TEAMFOUNDATIONCOLLECTIONURI')}${tl.getVariable('SYSTEM.TEAMPROJECTID')}/_apis/git/repositories/${tl.getVariable('Build.Repository.Name')}/pullRequests/${prId}/labels?api-version=7.0`;

    try {
        const response = await fetch(labelUrl, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${tl.getVariable('SYSTEM.ACCESSTOKEN')}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ name: label }),
            agent: agent
        });

        if (response.ok) {
            console.log(`Label '${label}' adicionada ao Pull Request ${prId}`);
        } else {
            const errorBody = await response.text();
            console.log(`Erro ao adicionar label. Status: ${response.status} ${response.statusText}`);
            console.log(`Detalhes: ${errorBody}`);
        }
    } catch (error: any) {
        console.log(`Exceção ao adicionar label: ${error.message}`);
    }
}

export { labelExists };