# Agentic AI Onboarding Guide

**Prompt for Agentic AI:**

You are an autonomous agentic AI assigned to this project. Your goal is to achieve the objectives outlined in this document and related files with minimal human intervention. Follow these instructions:

- Always read and reference the full `project_layout.md` and relevant documentation before acting.
- Use the provided folder structure and update this file if you create, move, or delete files/folders.
- Log all changes in the Change Log section, including what was changed, why, and by whom (e.g., "AI Agent").
- Adhere strictly to the Development Guidelines, coding standards, and branching strategy.
- If requirements are unclear, ask for clarification or propose a plan before proceeding.
- After making changes, run all tests and validate the project builds/runs correctly. Log any failures and resolutions.
- Collaborate transparently with human contributors, providing clear explanations for your actions and decisions.
- Keep documentation up-to-date with any structural or functional changes.
- Prioritize security, ethics, and best practices in all actions.

Begin by reviewing the project overview, architecture, and guidelines below. Then proceed to plan and execute tasks toward the stated goals.

---

# Project 1: Advanced Project Layout

## Overview
This document outlines the structure and layout for Project 1, an advanced software project. It includes sections for project description, architecture, features, development guidelines, and a change log to track edits and updates.

## Project Description
- **Name**: Project 1
- **Version**: 1.0.0
- **Description**: [Brief description of the project]
- **Technologies**: [List key technologies, e.g., HTML, CSS, JavaScript, Node.js]
- **Status**: In Development

## Architecture
### High-Level Architecture
- **Frontend**: [Describe frontend components]
- **Backend**: [Describe backend components]
- **Database**: [Describe data storage]
- **APIs**: [Describe any APIs or integrations]

### Folder Structure
```
Project 1/
├── docs/                 # Documentation
│   ├── README.md         # Project overview
│   ├── CHANGELOG.md      # Change log (optional separate file)
│   └── API.md            # API documentation
├── src/                  # Source code
│   ├── components/       # Reusable components
│   ├── pages/            # Page components
│   ├── services/         # API services
│   └── utils/            # Utility functions
├── tests/                # Test files
│   ├── unit/             # Unit tests
│   └── integration/      # Integration tests
├── config/               # Configuration files
├── public/               # Static assets
├── package.json          # Dependencies and scripts
├── .gitignore            # Git ignore rules
└── project_layout.md     # This file
```

## Features
- **Feature 1**: [Description]
- **Feature 2**: [Description]
- **Feature 3**: [Description]

## Development Guidelines
### Coding Standards
- Use [language/style guide, e.g., ESLint, Prettier]
- Follow [naming conventions, e.g., camelCase for variables]

### Branching Strategy
- `main`: Production-ready code
- `develop`: Integration branch
- Feature branches: `feature/feature-name`

### Testing
- Unit tests for individual functions
- Integration tests for end-to-end flows
- Run tests with `npm test`

### Deployment
- [Describe deployment process, e.g., CI/CD pipeline]

## Dependencies
- **Runtime**: [List runtime dependencies]
- **Development**: [List dev dependencies]

## Contributing
1. Fork the repository
2. Create a feature branch
3. Make changes and add tests
4. Submit a pull request

## Instructions for Angentic AI
If Angentic AI (or similar AI agents) are involved in this project, follow these guidelines to ensure consistency, context, and proper direction:

- **Context Provision**: Always start by reading and referencing the full `project_layout.md` file for project overview, architecture, and guidelines. Provide context from relevant source files, documentation, and the change log when making suggestions or edits.
- **Directions and Guidelines**: Strictly adhere to the Development Guidelines section, including coding standards, branching strategy, testing, and deployment processes. Do not deviate without explicit approval.
- **Change Logging**: For any edits, additions, or modifications to files, update the Change Log section in this file with details of what was changed, why, and by whom (e.g., "AI Agent"). Include dates and version bumps if applicable.
- **File Structure Adherence**: Maintain the specified folder structure. Do not create new files or folders without updating this layout document.
- **Collaboration**: If interacting with human developers, ask for clarification on ambiguous requirements. Provide clear, step-by-step explanations for proposed changes.
- **Error Handling**: If encountering issues (e.g., code errors, conflicts), document them in the change log and suggest resolutions based on best practices.
- **Security and Ethics**: Ensure all changes comply with security standards and ethical guidelines. Avoid introducing vulnerabilities or biased code.
- **Testing and Validation**: Always run tests after changes and validate that the project builds/runs correctly. Report any failures in the change log.
- **Documentation Updates**: Keep documentation (e.g., this file, README) up-to-date with any structural or functional changes.

These instructions ensure that Angentic AI contributions align with the project's goals and maintain high quality.

## License
[Specify license, e.g., MIT]

## Change Log
The change log is included in this file for simplicity. For larger projects, consider moving it to a separate `CHANGELOG.md` file following [Keep a Changelog](https://keepachangelog.com/) format.

### [Unreleased]
- Initial project layout setup

### [1.0.0] - 2025-10-03
- Added project structure and documentation template
- Created initial folder layout