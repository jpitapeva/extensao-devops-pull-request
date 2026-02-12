import { addAiReviewLabels } from 'pr-labels';

// ... existing code ...

// Call after review loop completes
addAiReviewLabels(pullRequestId);