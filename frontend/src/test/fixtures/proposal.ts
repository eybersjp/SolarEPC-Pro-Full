export interface ProposalTaskResponse {
    task_id: string;
    status: 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE';
    result_url?: string;
    error?: string;
}

export type ProposalStatusResponse = ProposalTaskResponse;

export const mockProposalTaskResponse: ProposalTaskResponse = {
    task_id: 'task-123',
    status: 'PENDING'
};

export const mockProposalStatusPending: ProposalStatusResponse = {
    task_id: 'task-123',
    status: 'PENDING'
};

export const mockProposalStatusStarted: ProposalStatusResponse = {
    task_id: 'task-123',
    status: 'STARTED'
};

export const mockProposalStatusSuccess: ProposalStatusResponse = {
    task_id: 'task-123',
    status: 'SUCCESS',
    result_url: 'http://localhost/proposals/task-123.pdf'
};

export const mockProposalStatusFailure: ProposalStatusResponse = {
    task_id: 'task-123',
    status: 'FAILURE',
    error: 'PDF generation failed'
};
