// Shared DTO/entity types used by the API and both Angular web apps.
// Authored to match docs/API_CONTRACT.M1.md and Spec Section 5.
// The Backend agent is the owner; web agents import these to stay in sync.

export * from './person';
export * from './union';
export * from './tribal-unit';
export * from './auth';
export * from './tenant';
export * from './tree';
export * from './roles';

// M2
export * from './change-request';
export * from './notification';

// M2.5
export * from './import';
