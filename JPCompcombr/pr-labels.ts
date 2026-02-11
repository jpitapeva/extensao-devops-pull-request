// pr-labels.ts

// Function to check if the label already exists in a pull request
async function labelExists(pullRequest, label) {
    return pullRequest.labels.some(existingLabel => existingLabel.name === label);
}

// Function to label pull requests with AI code review labels
async function addAiReviewLabels(pullRequest) {
    const aiLabels = ['AI Review', 'Needs AI Review', 'AI Approved'];
    for (const label of aiLabels) {
        if (!labelExists(pullRequest, label)) {
            await addLabelToPullRequest(pullRequest.id, label);
        }
    }
}

// Mock function to represent adding a label to a pull request
async function addLabelToPullRequest(prId, label) {
    // Implementation to add label to the pull request
    console.log(`Label '${label}' added to Pull Request ${prId}`);
}

export {addAiReviewLabels, labelExists};