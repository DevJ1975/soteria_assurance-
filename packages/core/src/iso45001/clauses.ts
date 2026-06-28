import type { ISO45001Clause } from './types';

/**
 * Canonical ISO 45001:2018 clause dataset.
 *
 * Covers every clause group (4–10) and every sub-clause / grandchild from the
 * standard's structure (including deep nodes such as 6.1.2, 8.1.4.1–8.1.4.3,
 * 9.2.1/9.2.2, 9.3.1–9.3.3, 10.1–10.3).
 *
 * IMPORTANT: requirementText values are PARAPHRASED for IP safety. They convey
 * the audit-relevant intent of each requirement without reproducing the
 * copyrighted text of the published standard.
 *
 * This is the single source of truth for clause data across the platform.
 * Never hardcode clause numbers, titles, or requirement text elsewhere.
 */
export const ISO45001_CLAUSES: ISO45001Clause[] = [
  // ==========================================================================
  // CLAUSE 4 — CONTEXT OF THE ORGANIZATION
  // ==========================================================================
  {
    number: '4',
    title: 'Context of the Organization',
    level: 1,
    requirementText:
      'The organization must understand the internal and external context in which it operates, the relevant interested parties, and use that understanding to define and establish an OH&S management system that achieves its intended outcomes.',
    auditFocus: [
      'Evidence that context, interested parties and scope have been determined and connect logically to the OH&S system',
      'Whether the management system reflects the organization’s actual activities and risk profile',
    ],
    typicalAuditQuestions: [
      'How did the organization determine the context for its OH&S management system?',
      'How does the defined scope align with the organization’s context and interested parties?',
    ],
    commonNonconformities: [
      'Context, interested parties and scope are treated as disconnected paperwork rather than an integrated foundation for the system',
      'The management system does not reflect actual operations identified through context analysis',
    ],
    expectedDocuments: [
      'OH&S management system manual or framework document',
      'Context and interested-parties analysis records',
    ],
    crossReferences: ['4.1', '4.2', '4.3', '4.4', '5.1', '6.1'],
  },
  {
    number: '4.1',
    title: 'Understanding the organization and its context',
    parentNumber: '4',
    level: 2,
    requirementText:
      'The organization must identify external and internal issues relevant to its purpose that affect its ability to achieve the intended outcomes of the OH&S management system.',
    auditFocus: [
      'A documented or demonstrable analysis of internal and external issues affecting OH&S',
      'Coverage of legal, technological, competitive, cultural, social and worker-related factors',
      'Evidence the issues are reviewed and kept current',
    ],
    typicalAuditQuestions: [
      'What internal and external issues has the organization identified as relevant to OH&S?',
      'How are these issues monitored and reviewed over time?',
      'How do identified issues feed into risk and opportunity planning?',
    ],
    commonNonconformities: [
      'No identification of internal/external issues relevant to OH&S',
      'Context analysis exists but is generic and not specific to the organization’s activities',
      'Issues are never reviewed or updated after initial creation',
    ],
    expectedDocuments: [
      'Context analysis (e.g. PESTLE or SWOT) records',
      'Strategic or business planning records referencing OH&S issues',
      'Management review inputs covering context changes',
    ],
    crossReferences: ['4.2', '4.3', '6.1.1', '9.3'],
  },
  {
    number: '4.2',
    title: 'Understanding the needs and expectations of workers and other interested parties',
    parentNumber: '4',
    level: 2,
    requirementText:
      'The organization must determine the workers and other interested parties relevant to the OH&S management system, their relevant needs and expectations, and which of these become compliance obligations.',
    auditFocus: [
      'A list of interested parties including workers, contractors, regulators, customers and the community',
      'Identification of which needs and expectations are adopted as requirements or legal/other obligations',
      'Process for keeping interested-party information current',
    ],
    typicalAuditQuestions: [
      'Who are the relevant interested parties for your OH&S management system?',
      'How do you determine which of their needs and expectations become compliance obligations?',
      'How are workers’ needs and expectations captured?',
    ],
    commonNonconformities: [
      'Interested parties identified but their relevant needs/expectations not determined',
      'Workers omitted or under-represented in the interested-party analysis',
      'No link between interested-party needs and legal/other requirements',
    ],
    expectedDocuments: [
      'Interested parties register',
      'Needs and expectations analysis',
      'Compliance obligations register',
    ],
    crossReferences: ['4.1', '4.3', '5.4', '6.1.3'],
  },
  {
    number: '4.3',
    title: 'Determining the scope of the OH&S management system',
    parentNumber: '4',
    level: 2,
    requirementText:
      'The organization must establish the boundaries and applicability of the OH&S management system, considering context, interested parties, planned/performed work-related activities, and authority and ability to exercise control, and document the scope.',
    auditFocus: [
      'A documented scope statement covering boundaries, activities, products/services and locations',
      'Justification that the scope is not narrowed to exclude activities with OH&S risk',
      'Consistency between scope and the organization’s actual operations',
    ],
    typicalAuditQuestions: [
      'What is the documented scope of your OH&S management system?',
      'How were context and interested parties considered when defining the scope?',
      'Are there any work-related activities under your control excluded from scope, and why?',
    ],
    commonNonconformities: [
      'Scope statement missing or not documented',
      'Scope excludes activities or sites that present OH&S risk',
      'Scope is inconsistent with the activities actually performed',
    ],
    expectedDocuments: [
      'Documented scope statement',
      'Site/activity listing supporting the scope',
    ],
    crossReferences: ['4.1', '4.2', '4.4', '8.1'],
  },
  {
    number: '4.4',
    title: 'OH&S management system',
    parentNumber: '4',
    level: 2,
    requirementText:
      'The organization must establish, implement, maintain and continually improve an OH&S management system, including the processes needed and their interactions, in line with the standard’s requirements.',
    auditFocus: [
      'Evidence the system and its processes are established and interacting as intended',
      'Process sequence and interactions are understood and managed',
      'The system is maintained and improving, not static',
    ],
    typicalAuditQuestions: [
      'How is your OH&S management system structured and what are its key processes?',
      'How do the processes interact and how are those interactions managed?',
      'How do you demonstrate the system is maintained and continually improved?',
    ],
    commonNonconformities: [
      'Processes defined on paper but not implemented or interacting in practice',
      'No evidence the system is maintained or improved over time',
    ],
    expectedDocuments: [
      'Process maps / system interaction diagrams',
      'OH&S management system manual',
      'Process descriptions and procedures',
    ],
    crossReferences: ['4.3', '5.1', '6.1', '10.3'],
  },

  // ==========================================================================
  // CLAUSE 5 — LEADERSHIP AND WORKER PARTICIPATION
  // ==========================================================================
  {
    number: '5',
    title: 'Leadership and Worker Participation',
    level: 1,
    requirementText:
      'Top management must demonstrate leadership and commitment to the OH&S management system, establish policy and roles, and ensure consultation and participation of workers at all applicable levels.',
    auditFocus: [
      'Visible, active top-management leadership rather than delegated lip service',
      'A culture supporting worker consultation and participation',
    ],
    typicalAuditQuestions: [
      'How does top management demonstrate leadership and commitment to OH&S?',
      'How are workers consulted and enabled to participate in OH&S decisions?',
    ],
    commonNonconformities: [
      'Leadership commitment claimed but not evidenced in resourcing or decisions',
      'Worker participation is tokenistic or limited to a narrow group',
    ],
    expectedDocuments: [
      'OH&S policy',
      'Roles and responsibilities documentation',
      'Records of worker consultation and participation',
    ],
    crossReferences: ['5.1', '5.2', '5.3', '5.4', '7.4'],
  },
  {
    number: '5.1',
    title: 'Leadership and commitment',
    parentNumber: '5',
    level: 2,
    requirementText:
      'Top management must take overall accountability for worker safety and health, ensure the OH&S policy and objectives are established and compatible with strategy, integrate OH&S into business processes, provide resources, communicate the importance of OH&S, ensure intended outcomes are achieved, direct and support workers, develop a positive OH&S culture, and protect workers from reprisals when reporting.',
    auditFocus: [
      'Top management can describe and own the OH&S system, not just delegate it',
      'OH&S integrated into business decision-making and resourcing',
      'A culture protecting workers who report incidents, hazards or concerns from retaliation',
    ],
    typicalAuditQuestions: [
      'How does top management take accountability for preventing work-related injury and ill health?',
      'How is OH&S integrated into your core business processes?',
      'How are workers protected from reprisals when they report hazards or incidents?',
    ],
    commonNonconformities: [
      'Top management cannot articulate OH&S objectives or system performance',
      'OH&S treated as a separate function rather than integrated into the business',
      'No mechanism to protect workers reporting concerns from reprisal',
    ],
    expectedDocuments: [
      'Management review records',
      'Resource allocation / budget evidence for OH&S',
      'Internal communications from leadership on OH&S',
    ],
    crossReferences: ['5.2', '5.3', '5.4', '7.1', '9.3'],
  },
  {
    number: '5.2',
    title: 'OH&S policy',
    parentNumber: '5',
    level: 2,
    requirementText:
      'Top management must establish a documented OH&S policy that includes commitments to provide safe and healthy working conditions, to fulfil legal and other requirements, to eliminate hazards and reduce OH&S risks, to continually improve, and to consult and enable participation of workers; the policy must be communicated, available, and appropriate to the organization.',
    auditFocus: [
      'Policy contains all required commitments (safe conditions, legal compliance, hazard elimination/risk reduction, continual improvement, worker consultation)',
      'Policy is documented, communicated and available to workers and interested parties',
      'Policy is appropriate to the organization’s purpose, size and OH&S risks',
    ],
    typicalAuditQuestions: [
      'Can you show me the OH&S policy and confirm it includes all required commitments?',
      'How is the policy communicated to workers and made available to interested parties?',
      'How do workers understand what the policy means for their daily work?',
    ],
    commonNonconformities: [
      'Policy missing one or more mandatory commitments (e.g. hazard elimination, worker consultation)',
      'Policy not communicated to or understood by workers',
      'Policy is generic boilerplate not appropriate to the organization',
    ],
    expectedDocuments: [
      'Signed and dated OH&S policy',
      'Policy communication records (notice boards, inductions, intranet)',
    ],
    crossReferences: ['5.1', '6.2.1', '7.4', '8.1.2'],
  },
  {
    number: '5.3',
    title: 'Organizational roles, responsibilities, and authorities',
    parentNumber: '5',
    level: 2,
    requirementText:
      'Top management must assign and communicate the responsibilities and authorities for relevant roles within the OH&S management system, ensuring accountability remains with top management; workers at each level must take responsibility for the aspects of the system they control.',
    auditFocus: [
      'Roles, responsibilities and authorities defined and communicated',
      'Workers understand their own OH&S responsibilities',
      'Accountability for the system is retained by top management',
    ],
    typicalAuditQuestions: [
      'How are OH&S roles, responsibilities and authorities assigned and communicated?',
      'Can workers describe their own OH&S responsibilities?',
      'Who is accountable overall for the OH&S management system?',
    ],
    commonNonconformities: [
      'Responsibilities defined but not communicated to the people holding them',
      'Workers unaware of their OH&S responsibilities',
      'Accountability ambiguous or assumed to be delegated entirely to a safety officer',
    ],
    expectedDocuments: [
      'Organization chart',
      'Job descriptions / role responsibility matrices',
      'OH&S responsibility communication records',
    ],
    crossReferences: ['5.1', '7.2', '7.3', '7.4'],
  },
  {
    number: '5.4',
    title: 'Consultation and participation of workers',
    parentNumber: '5',
    level: 2,
    requirementText:
      'The organization must establish processes for consultation and participation of workers (including non-managerial workers) in developing, planning, implementing, evaluating and improving the OH&S management system, providing mechanisms, time, training and resources, removing barriers, and emphasizing consultation of non-managerial workers on specific matters such as hazard identification and incident investigation.',
    auditFocus: [
      'Mechanisms exist for workers to be consulted and to participate (committees, toolbox talks, suggestion schemes)',
      'Barriers to participation (language, literacy, reprisal fears, cost) are identified and removed',
      'Non-managerial workers are consulted on the specific matters the standard emphasizes',
    ],
    typicalAuditQuestions: [
      'How are non-managerial workers consulted on hazard identification and incident investigation?',
      'What barriers to participation exist and how have they been addressed?',
      'Can you show examples where worker input changed an OH&S decision?',
    ],
    commonNonconformities: [
      'Consultation limited to management or a safety committee only',
      'Barriers to participation (e.g. language, reprisal) not addressed',
      'No evidence non-managerial workers were consulted on required matters',
    ],
    expectedDocuments: [
      'Safety committee minutes',
      'Toolbox talk / consultation records',
      'Worker suggestion and feedback records',
    ],
    crossReferences: ['4.2', '5.1', '6.1.2', '10.2'],
  },

  // ==========================================================================
  // CLAUSE 6 — PLANNING
  // ==========================================================================
  {
    number: '6',
    title: 'Planning',
    level: 1,
    requirementText:
      'The organization must plan the OH&S management system by addressing risks and opportunities, legal and other requirements, and by setting OH&S objectives with plans to achieve them.',
    auditFocus: [
      'A coherent planning process linking risks, opportunities, legal requirements and objectives',
      'Planning outputs that drive operational controls and improvement',
    ],
    typicalAuditQuestions: [
      'How does your OH&S planning process work end to end?',
      'How do planning outputs connect to operational controls and objectives?',
    ],
    commonNonconformities: [
      'Planning elements exist in isolation and are not connected',
      'Planning does not result in actions that are implemented and tracked',
    ],
    expectedDocuments: [
      'Risk and opportunity registers',
      'Legal and other requirements register',
      'OH&S objectives and action plans',
    ],
    crossReferences: ['6.1', '6.2', '8.1', '9.1'],
  },
  {
    number: '6.1',
    title: 'Actions to address risks and opportunities',
    parentNumber: '6',
    level: 2,
    requirementText:
      'The organization must plan actions to address OH&S risks and opportunities, other risks and opportunities, legal and other requirements, and to prepare for and respond to emergency situations, taking context and interested parties into account.',
    auditFocus: [
      'A planning process that integrates hazards, risks, opportunities and legal requirements',
      'Evidence the outputs of 6.1.1–6.1.4 feed into planned action',
    ],
    typicalAuditQuestions: [
      'How do you determine the risks and opportunities that need to be addressed?',
      'How are the outputs of hazard identification and legal review turned into planned actions?',
    ],
    commonNonconformities: [
      'Risk and opportunity determination does not consider context or interested parties',
      'No traceable link between identified risks and the actions taken',
    ],
    expectedDocuments: [
      'Risk and opportunity assessment records',
      'Action plans arising from risk assessment',
    ],
    crossReferences: ['4.1', '4.2', '6.1.1', '6.1.2', '6.1.3', '6.1.4', '8.1.2'],
  },
  {
    number: '6.1.1',
    title: 'General',
    parentNumber: '6.1',
    level: 3,
    requirementText:
      'When planning the OH&S management system, the organization must consider the issues from context, the requirements of interested parties, and the scope, and determine the risks and opportunities that need to be addressed to give assurance the system can achieve its outcomes, prevent or reduce undesired effects, and achieve continual improvement; it must maintain documented information on these risks and opportunities and on the processes used to determine them.',
    auditFocus: [
      'Determination of risks and opportunities considers context (4.1), interested parties (4.2) and scope (4.3)',
      'Documented information on risks/opportunities and the determination process is retained',
      'Risks and opportunities address both OH&S and the system itself',
    ],
    typicalAuditQuestions: [
      'How do context and interested-party requirements feed into determining risks and opportunities?',
      'What documented information do you keep on this process?',
      'How do you distinguish OH&S risks from risks to the management system?',
    ],
    commonNonconformities: [
      'Risks and opportunities determined without reference to context or interested parties',
      'No documented information retained on the determination process',
    ],
    expectedDocuments: [
      'Risk and opportunity register',
      'Methodology / procedure for determining risks and opportunities',
    ],
    crossReferences: ['4.1', '4.2', '4.3', '6.1.2', '6.1.4'],
  },
  {
    number: '6.1.2',
    title: 'Hazard identification and assessment of OH&S risks',
    parentNumber: '6.1',
    level: 3,
    requirementText:
      'The organization must establish ongoing, proactive processes to identify hazards (considering routine and non-routine activities, human factors, past incidents, emergency situations, people and their access, and changes), assess OH&S risks and other risks to the system, identify and assess OH&S opportunities, and use a defined methodology and criteria that is proactive rather than purely reactive.',
    auditFocus: [
      'Hazard identification is ongoing and proactive, covering routine, non-routine and emergency situations and human factors',
      'Risk assessment methodology and criteria are defined, documented and applied consistently',
      'Workers are involved in hazard identification and risk assessment',
      'Opportunities for OH&S improvement are also identified',
    ],
    typicalAuditQuestions: [
      'How are hazards identified, and how often is this repeated?',
      'How do you account for human factors, non-routine activities and emergency situations?',
      'What methodology and risk criteria do you use to assess OH&S risks?',
      'How are workers involved in hazard identification?',
    ],
    commonNonconformities: [
      'Hazard identification is reactive (only after incidents) rather than proactive and ongoing',
      'Human factors, non-routine tasks or emergency situations not considered',
      'Risk assessment methodology undefined or applied inconsistently',
      'Workers not involved in identifying hazards in their own areas',
    ],
    expectedDocuments: [
      'Hazard identification and risk assessment (HIRA) records',
      'Risk assessment methodology / criteria',
      'Job safety analyses and task-based risk assessments',
    ],
    crossReferences: ['5.4', '6.1.1', '6.1.4', '8.1.2', '8.2', '10.2'],
  },
  {
    number: '6.1.3',
    title: 'Determination of legal and other requirements',
    parentNumber: '6.1',
    level: 3,
    requirementText:
      'The organization must establish processes to determine and have access to up-to-date legal requirements and other requirements applicable to its hazards, OH&S risks and management system, determine how they apply, and take them into account when establishing and maintaining the system; documented information on legal and other requirements must be maintained and kept current.',
    auditFocus: [
      'A maintained register of applicable legal and other requirements',
      'Process to identify changes in requirements and keep the register current',
      'Evidence requirements are taken into account in the system and operations',
    ],
    typicalAuditQuestions: [
      'How do you identify the legal and other requirements applicable to your OH&S?',
      'How do you stay current when legislation changes?',
      'How do these requirements influence your controls and objectives?',
    ],
    commonNonconformities: [
      'Legal register incomplete or out of date',
      'No process to detect and incorporate changes in legislation',
      'Requirements identified but not reflected in operational controls',
    ],
    expectedDocuments: [
      'Legal and other requirements register',
      'Subscription / update service records or legal review records',
    ],
    crossReferences: ['4.2', '6.1.1', '9.1.2', '9.3'],
  },
  {
    number: '6.1.4',
    title: 'Planning action',
    parentNumber: '6.1',
    level: 3,
    requirementText:
      'The organization must plan actions to address its risks and opportunities, legal and other requirements, and emergency situations; integrate and implement these actions into the OH&S management system processes or other business processes; and evaluate the effectiveness of these actions, considering the hierarchy of controls and best practices.',
    auditFocus: [
      'Actions planned for risks, opportunities, legal requirements and emergencies',
      'Actions integrated into OH&S or business processes, not standalone lists',
      'Effectiveness of actions is evaluated and the hierarchy of controls considered',
    ],
    typicalAuditQuestions: [
      'How do you plan actions to address the risks and opportunities you identified?',
      'How are these actions integrated into your processes?',
      'How do you evaluate whether the actions were effective?',
    ],
    commonNonconformities: [
      'Actions planned but not implemented or tracked to completion',
      'Effectiveness of actions never evaluated',
      'Hierarchy of controls not considered when selecting actions',
    ],
    expectedDocuments: [
      'Action plans linked to risk assessments',
      'Effectiveness evaluation records',
    ],
    crossReferences: ['6.1.1', '6.1.2', '6.1.3', '8.1.2', '8.2', '9.1.1'],
  },
  {
    number: '6.2',
    title: 'OH&S objectives and planning to achieve them',
    parentNumber: '6',
    level: 2,
    requirementText:
      'The organization must establish OH&S objectives at relevant functions and levels to maintain and continually improve the system and OH&S performance, and plan how to achieve them.',
    auditFocus: [
      'Objectives established at relevant functions and levels',
      'Objectives consistent with policy and measurable where practicable',
      'Plans to achieve objectives are defined and resourced',
    ],
    typicalAuditQuestions: [
      'What OH&S objectives have you set and at what levels?',
      'How do these objectives relate to your OH&S policy and risks?',
      'How do you plan and track progress against objectives?',
    ],
    commonNonconformities: [
      'No measurable OH&S objectives established',
      'Objectives not aligned with policy or significant risks',
    ],
    expectedDocuments: [
      'OH&S objectives register',
      'Objective achievement plans',
    ],
    crossReferences: ['5.2', '6.2.1', '6.2.2', '9.1.1', '9.3'],
  },
  {
    number: '6.2.1',
    title: 'OH&S objectives',
    parentNumber: '6.2',
    level: 3,
    requirementText:
      'OH&S objectives must be consistent with the OH&S policy, measurable or capable of performance evaluation, take into account requirements and the results of risk/opportunity assessment and consultation with workers, be monitored, communicated and updated as appropriate.',
    auditFocus: [
      'Objectives are consistent with policy and measurable or evaluable',
      'Objectives reflect risk assessment results and worker consultation',
      'Objectives are monitored, communicated and updated',
    ],
    typicalAuditQuestions: [
      'How are your OH&S objectives measurable or evaluated?',
      'How did risk assessment and worker consultation shape your objectives?',
      'How are objectives communicated and kept up to date?',
    ],
    commonNonconformities: [
      'Objectives not measurable and no method to evaluate performance',
      'Objectives not communicated to relevant workers',
      'Objectives not updated when circumstances change',
    ],
    expectedDocuments: [
      'Documented OH&S objectives with targets',
      'Communication records of objectives',
    ],
    crossReferences: ['5.2', '5.4', '6.1.2', '6.2.2', '9.1.1'],
  },
  {
    number: '6.2.2',
    title: 'Planning to achieve OH&S objectives',
    parentNumber: '6.2',
    level: 3,
    requirementText:
      'When planning to achieve its OH&S objectives, the organization must determine what will be done, what resources are required, who is responsible, when it will be completed, how results will be evaluated (including indicators for monitoring), and how the actions will be integrated into business processes.',
    auditFocus: [
      'Each objective has defined actions, resources, responsibilities and timelines',
      'Indicators are defined to monitor progress',
      'Plans are integrated into business processes',
    ],
    typicalAuditQuestions: [
      'For each objective, who is responsible and by when must it be achieved?',
      'What resources have been allocated to achieve the objectives?',
      'What indicators do you use to monitor progress toward objectives?',
    ],
    commonNonconformities: [
      'Objectives set but no plan defining how they will be achieved',
      'No responsibilities, timelines or resources assigned to objectives',
      'No indicators to evaluate progress',
    ],
    expectedDocuments: [
      'Objective action plans with responsibilities and deadlines',
      'Progress monitoring records / KPI dashboards',
    ],
    crossReferences: ['6.2.1', '7.1', '9.1.1'],
  },

  // ==========================================================================
  // CLAUSE 7 — SUPPORT
  // ==========================================================================
  {
    number: '7',
    title: 'Support',
    level: 1,
    requirementText:
      'The organization must provide the resources, competence, awareness, communication and documented information needed to establish, implement, maintain and continually improve the OH&S management system.',
    auditFocus: [
      'Adequate resources, competent people and effective communication support the system',
      'Documented information is controlled and available where needed',
    ],
    typicalAuditQuestions: [
      'How do you ensure the resources and competence needed for OH&S are available?',
      'How is OH&S information communicated and documented information controlled?',
    ],
    commonNonconformities: [
      'Resources or competence insufficient to operate the system effectively',
      'Documented information not controlled or not available at point of use',
    ],
    expectedDocuments: [
      'Competence and training records',
      'Communication plans',
      'Document control procedure',
    ],
    crossReferences: ['7.1', '7.2', '7.3', '7.4', '7.5', '8.1'],
  },
  {
    number: '7.1',
    title: 'Resources',
    parentNumber: '7',
    level: 2,
    requirementText:
      'The organization must determine and provide the resources needed to establish, implement, maintain and continually improve the OH&S management system, including human resources, infrastructure, technology and financial resources.',
    auditFocus: [
      'Resources (people, infrastructure, finance, technology) are determined and provided',
      'Resource adequacy is reviewed as needs change',
    ],
    typicalAuditQuestions: [
      'How do you determine the resources needed for the OH&S management system?',
      'How do you ensure those resources are actually provided?',
      'How is resource adequacy reviewed over time?',
    ],
    commonNonconformities: [
      'OH&S activities not resourced (e.g. no budget, insufficient staff)',
      'Resource needs never formally determined',
    ],
    expectedDocuments: [
      'Budget allocations for OH&S',
      'Resource / infrastructure plans',
      'Management review outputs on resourcing',
    ],
    crossReferences: ['5.1', '7.2', '9.3'],
  },
  {
    number: '7.2',
    title: 'Competence',
    parentNumber: '7',
    level: 2,
    requirementText:
      'The organization must determine the competence of workers affecting OH&S performance, ensure they are competent based on education, training or experience, take action to acquire and evaluate the effectiveness of needed competence, and retain documented information as evidence of competence.',
    auditFocus: [
      'Competence requirements determined for roles affecting OH&S',
      'Workers are demonstrably competent (training, experience, qualifications)',
      'Effectiveness of competence actions is evaluated and records retained',
    ],
    typicalAuditQuestions: [
      'How do you determine the competence needed for roles affecting OH&S?',
      'How do you verify that workers are competent for hazardous tasks?',
      'How do you evaluate whether training was effective?',
    ],
    commonNonconformities: [
      'Competence requirements not defined for safety-critical roles',
      'Workers performing hazardous tasks without evidence of competence',
      'No evaluation of training effectiveness',
    ],
    expectedDocuments: [
      'Competence matrices / training needs analysis',
      'Training records and certificates',
      'Competence assessment records',
    ],
    crossReferences: ['5.3', '7.3', '8.1.1', '8.1.4.2'],
  },
  {
    number: '7.3',
    title: 'Awareness',
    parentNumber: '7',
    level: 2,
    requirementText:
      'Workers must be made aware of the OH&S policy and objectives, their contribution to system effectiveness and the benefits of improved performance, the implications of not conforming, incidents and their outcomes, the hazards and risks relevant to them, and their ability to remove themselves from situations they consider to present serious and imminent danger.',
    auditFocus: [
      'Workers are aware of policy, objectives and relevant hazards/risks',
      'Workers understand they can remove themselves from imminent danger without reprisal',
      'Awareness extends to incidents and the consequences of nonconformity',
    ],
    typicalAuditQuestions: [
      'How are workers made aware of the OH&S policy and the hazards relevant to them?',
      'Do workers know they can remove themselves from situations of serious and imminent danger?',
      'How are workers informed about incidents and their outcomes?',
    ],
    commonNonconformities: [
      'Workers unaware of OH&S policy or the hazards in their work',
      'Workers unaware of their right to remove themselves from imminent danger',
      'No process to communicate incident outcomes to workers',
    ],
    expectedDocuments: [
      'Induction and awareness training records',
      'Toolbox talk records',
      'Awareness communications (posters, briefings)',
    ],
    crossReferences: ['5.2', '5.4', '7.4', '8.2', '10.2'],
  },
  {
    number: '7.4',
    title: 'Communication',
    parentNumber: '7',
    level: 2,
    requirementText:
      'The organization must establish processes for the internal and external communications relevant to the OH&S management system, determining what, when, with whom and how to communicate, taking account of diversity aspects and the views of interested parties, and ensuring communicated OH&S information is consistent and reliable.',
    auditFocus: [
      'Communication processes define what, when, with whom and how',
      'Internal communication enables workers to contribute to improvement',
      'External communication addresses legal/other requirements and interested parties',
      'Diversity factors (language, literacy, disability) are considered',
    ],
    typicalAuditQuestions: [
      'How do you decide what OH&S information to communicate, to whom and how?',
      'How do you account for diversity, such as language and literacy, in communications?',
      'How do you handle relevant external OH&S communications?',
    ],
    commonNonconformities: [
      'No defined communication process; communication is ad hoc',
      'Diversity factors (e.g. non-native-language workers) not considered',
      'External communications related to OH&S not managed',
    ],
    expectedDocuments: [
      'Communication procedure / matrix',
      'Records of internal and external OH&S communications',
    ],
    crossReferences: ['4.2', '5.4', '7.3', '10.2'],
  },
  {
    number: '7.5',
    title: 'Documented information',
    parentNumber: '7',
    level: 2,
    requirementText:
      'The OH&S management system must include the documented information required by the standard and that determined by the organization as necessary for system effectiveness.',
    auditFocus: [
      'Documented information required by the standard is present',
      'Additional documented information needed for effectiveness is identified',
    ],
    typicalAuditQuestions: [
      'What documented information does your OH&S system maintain and retain?',
      'How did you decide what additional documentation is necessary?',
    ],
    commonNonconformities: [
      'Documented information required by the standard is missing',
      'Documentation exists but does not support effective operation',
    ],
    expectedDocuments: [
      'Master document list / document register',
    ],
    crossReferences: ['7.5.1', '7.5.2', '7.5.3'],
  },
  {
    number: '7.5.1',
    title: 'General',
    parentNumber: '7.5',
    level: 3,
    requirementText:
      'The system must include documented information required by the standard and that determined necessary by the organization; the extent of documented information can vary based on the organization’s size, activities, processes and competence of workers.',
    auditFocus: [
      'Documented information is proportionate to organization size and complexity',
      'Both standard-required and organization-determined documentation are covered',
    ],
    typicalAuditQuestions: [
      'How extensive is your documented information and why is that level appropriate?',
      'How do you ensure you have the documentation the standard requires?',
    ],
    commonNonconformities: [
      'Documentation level disproportionate to the organization’s risk and complexity',
      'Organization-determined documentation not identified',
    ],
    expectedDocuments: [
      'Document register identifying required documented information',
    ],
    crossReferences: ['7.5', '7.5.2', '7.5.3'],
  },
  {
    number: '7.5.2',
    title: 'Creating and updating',
    parentNumber: '7.5',
    level: 3,
    requirementText:
      'When creating and updating documented information, the organization must ensure appropriate identification and description, appropriate format and media, and appropriate review and approval for suitability and adequacy.',
    auditFocus: [
      'Documents have proper identification (title, date, author, reference)',
      'Documents are in an appropriate format and medium',
      'Documents are reviewed and approved before use',
    ],
    typicalAuditQuestions: [
      'How are documents identified, described and formatted?',
      'Who reviews and approves documents before they are issued?',
      'How do you ensure updated documents replace obsolete versions?',
    ],
    commonNonconformities: [
      'Documents lack identification such as version, date or approval',
      'Documents in use without review or approval',
    ],
    expectedDocuments: [
      'Controlled document templates',
      'Document approval records',
    ],
    crossReferences: ['7.5.1', '7.5.3'],
  },
  {
    number: '7.5.3',
    title: 'Control of documented information',
    parentNumber: '7.5',
    level: 3,
    requirementText:
      'Documented information must be controlled so it is available and suitable where and when needed and adequately protected; control addresses distribution, access, retrieval, use, storage, preservation, version control, retention and disposition, including control of documents of external origin determined necessary.',
    auditFocus: [
      'Documents are available and suitable at the point of use',
      'Version control prevents use of obsolete documents',
      'Documented information is protected (confidentiality, integrity, loss)',
      'External-origin documents are controlled',
    ],
    typicalAuditQuestions: [
      'How do you control access to and distribution of documented information?',
      'How do you prevent the use of obsolete documents?',
      'How are records retained and protected against loss?',
    ],
    commonNonconformities: [
      'Obsolete documents still in use at the point of work',
      'Records not retained for required periods or not protected',
      'External documents (e.g. SDS, legislation) not controlled',
    ],
    expectedDocuments: [
      'Document control procedure',
      'Records retention schedule',
      'Version-controlled document repository',
    ],
    crossReferences: ['7.5.1', '7.5.2', '8.1.1', '9.2.2'],
  },

  // ==========================================================================
  // CLAUSE 8 — OPERATION
  // ==========================================================================
  {
    number: '8',
    title: 'Operation',
    level: 1,
    requirementText:
      'The organization must plan, implement, control and maintain the operational processes needed to meet OH&S requirements and to implement the actions from Clause 6, including emergency preparedness and response.',
    auditFocus: [
      'Operational controls implement planning outputs and apply the hierarchy of controls',
      'Emergency preparedness and response arrangements are in place and tested',
    ],
    typicalAuditQuestions: [
      'How are operational controls established to manage your OH&S risks?',
      'How are emergencies planned for and responded to?',
    ],
    commonNonconformities: [
      'Operational controls do not implement the planned actions from Clause 6',
      'Emergency arrangements undocumented or untested',
    ],
    expectedDocuments: [
      'Operational control procedures',
      'Emergency response plans',
    ],
    crossReferences: ['6.1', '8.1', '8.2'],
  },
  {
    number: '8.1',
    title: 'Operational planning and control',
    parentNumber: '8',
    level: 2,
    requirementText:
      'The organization must plan, implement, control and maintain the processes needed to meet OH&S requirements and implement Clause 6 actions, by establishing criteria and controls in line with the criteria, maintaining documented information, and adapting work to workers.',
    auditFocus: [
      'Operational criteria and controls are established and followed',
      'Documented information confirms processes are carried out as planned',
      'Work is adapted to workers (human factors)',
    ],
    typicalAuditQuestions: [
      'How are operational controls planned and maintained for your hazardous processes?',
      'How do you confirm controls are applied as planned?',
      'How is work adapted to workers rather than forcing workers to adapt to work?',
    ],
    commonNonconformities: [
      'Controls defined but not implemented in practice',
      'No criteria established for hazardous operations',
    ],
    expectedDocuments: [
      'Safe systems of work / standard operating procedures',
      'Permit-to-work records',
    ],
    crossReferences: ['6.1.4', '8.1.1', '8.1.2', '8.1.3', '8.1.4', '8.2'],
  },
  {
    number: '8.1.1',
    title: 'General',
    parentNumber: '8.1',
    level: 3,
    requirementText:
      'The organization must establish, implement and control operational processes by establishing criteria for them, implementing control in line with those criteria, maintaining documented information to confirm processes were carried out as planned, and ensuring control extends to procurement, contractors and other relevant parties; in multi-employer workplaces, it must coordinate relevant parts of the system with other organizations.',
    auditFocus: [
      'Operating criteria established and controls implemented accordingly',
      'Documented information confirms processes were carried out as planned',
      'Coordination in multi-employer workplaces',
    ],
    typicalAuditQuestions: [
      'What criteria have you set for controlling your operational processes?',
      'How do you confirm and record that processes are carried out as planned?',
      'In shared workplaces, how do you coordinate OH&S with other employers?',
    ],
    commonNonconformities: [
      'Operating criteria not established for high-risk processes',
      'No records confirming controls were carried out as planned',
      'No coordination with other employers in shared workplaces',
    ],
    expectedDocuments: [
      'Operational procedures with defined criteria',
      'Process control / checklist records',
    ],
    crossReferences: ['7.5.3', '8.1.2', '8.1.4.1', '8.2'],
  },
  {
    number: '8.1.2',
    title: 'Eliminating hazards and reducing OH&S risks',
    parentNumber: '8.1',
    level: 3,
    requirementText:
      'The organization must establish processes for the elimination of hazards and reduction of OH&S risks using the hierarchy of controls: eliminate the hazard; substitute with less hazardous processes, operations, materials or equipment; use engineering controls and reorganization of work; use administrative controls including training; and use adequate personal protective equipment.',
    auditFocus: [
      'The hierarchy of controls is applied in the correct order, prioritising elimination',
      'PPE is treated as a last resort, not a default control',
      'Controls are implemented and effective in practice',
    ],
    typicalAuditQuestions: [
      'How do you apply the hierarchy of controls when reducing risks?',
      'Can you show an example where a hazard was eliminated or substituted rather than relying on PPE?',
      'How do you verify implemented controls are effective?',
    ],
    commonNonconformities: [
      'PPE relied upon when higher-order controls were reasonably practicable',
      'Hierarchy of controls not applied or not documented',
      'Controls implemented but not verified as effective',
    ],
    expectedDocuments: [
      'Risk assessments showing hierarchy-of-controls decisions',
      'Engineering control / substitution records',
    ],
    crossReferences: ['5.2', '6.1.2', '6.1.4', '8.1.3'],
  },
  {
    number: '8.1.3',
    title: 'Management of change',
    parentNumber: '8.1',
    level: 3,
    requirementText:
      'The organization must establish processes for implementing and controlling planned temporary and permanent changes that affect OH&S performance, including new or changed products, services, processes, legal requirements, knowledge about hazards, and developments in technology, and must review the consequences of unintended changes and act to mitigate adverse effects.',
    auditFocus: [
      'A management-of-change process covering temporary and permanent changes',
      'OH&S risks of changes assessed before implementation',
      'Consequences of unintended changes reviewed and mitigated',
    ],
    typicalAuditQuestions: [
      'How do you manage OH&S risks arising from planned changes?',
      'How are temporary changes controlled?',
      'How do you review and mitigate the consequences of unintended changes?',
    ],
    commonNonconformities: [
      'Changes implemented without assessing OH&S impact',
      'Temporary changes not controlled or not reverted properly',
      'No review of unintended changes',
    ],
    expectedDocuments: [
      'Management of change procedure',
      'Change request and risk-assessment records',
    ],
    crossReferences: ['6.1.2', '8.1.2', '10.2'],
  },
  {
    number: '8.1.4',
    title: 'Procurement',
    parentNumber: '8.1',
    level: 3,
    requirementText:
      'The organization must establish processes to control the procurement of products and services to ensure conformity with the OH&S management system, including arrangements for contractors and for outsourced functions and processes.',
    auditFocus: [
      'Procurement processes ensure purchased goods/services conform to OH&S requirements',
      'Contractor and outsourcing arrangements are covered',
    ],
    typicalAuditQuestions: [
      'How do you ensure procured products and services meet your OH&S requirements?',
      'How are contractors and outsourced functions controlled through procurement?',
    ],
    commonNonconformities: [
      'OH&S requirements not built into procurement',
      'Contractors or outsourced processes not controlled',
    ],
    expectedDocuments: [
      'Procurement procedure with OH&S criteria',
      'Approved supplier / contractor lists',
    ],
    crossReferences: ['8.1.4.1', '8.1.4.2', '8.1.4.3'],
  },
  {
    number: '8.1.4.1',
    title: 'General',
    parentNumber: '8.1.4',
    level: 4,
    requirementText:
      'The organization must establish and maintain processes to control the procurement of products and services so as to ensure their conformity with the OH&S management system, identifying and applying OH&S controls to purchased products, hazardous materials, equipment and services before they are used.',
    auditFocus: [
      'OH&S criteria applied when purchasing products, equipment and services',
      'Hazardous materials and equipment assessed before use',
      'Pre-use verification that procured items meet OH&S requirements',
    ],
    typicalAuditQuestions: [
      'How are OH&S requirements specified during procurement of equipment or chemicals?',
      'How do you verify procured items meet OH&S requirements before use?',
      'How do you control the introduction of hazardous materials?',
    ],
    commonNonconformities: [
      'Equipment or chemicals introduced without OH&S assessment',
      'No OH&S specifications included in purchasing requirements',
    ],
    expectedDocuments: [
      'Procurement specifications including OH&S requirements',
      'Pre-use inspection / acceptance records',
      'Safety data sheets for procured chemicals',
    ],
    crossReferences: ['7.2', '8.1.1', '8.1.4.2', '8.1.4.3'],
  },
  {
    number: '8.1.4.2',
    title: 'Contractors',
    parentNumber: '8.1.4',
    level: 4,
    requirementText:
      'The organization must coordinate its procurement processes with contractors to identify hazards and assess and control OH&S risks arising from contractors’ activities affecting the organization, the organization’s activities affecting contractors’ workers, and contractors’ activities affecting other interested parties; it must ensure contractors and their workers meet the organization’s OH&S requirements, applying criteria for selecting contractors.',
    auditFocus: [
      'Contractor selection criteria include OH&S performance and competence',
      'Hazards and risks from contractor activities are coordinated and controlled',
      'Contractor workers meet the organization’s OH&S requirements (induction, competence)',
    ],
    typicalAuditQuestions: [
      'What OH&S criteria do you use to select and evaluate contractors?',
      'How do you coordinate hazard control between your operations and contractors?',
      'How do you verify contractor workers are competent and inducted?',
    ],
    commonNonconformities: [
      'Contractors selected without OH&S evaluation',
      'No coordination of overlapping hazards between organization and contractors',
      'Contractor workers not inducted or competence not verified',
    ],
    expectedDocuments: [
      'Contractor prequalification / selection records',
      'Contractor OH&S requirements and induction records',
      'Contractor performance monitoring records',
    ],
    crossReferences: ['7.2', '8.1.1', '8.1.4.1', '8.1.4.3'],
  },
  {
    number: '8.1.4.3',
    title: 'Outsourcing',
    parentNumber: '8.1.4',
    level: 4,
    requirementText:
      'The organization must ensure that outsourced functions and processes are controlled, defining within the OH&S management system the type and degree of control to be applied, consistent with legal and other requirements and the achievement of intended outcomes.',
    auditFocus: [
      'Outsourced functions/processes are identified',
      'The type and degree of control over outsourced processes is defined',
      'Control is consistent with legal requirements and intended outcomes',
    ],
    typicalAuditQuestions: [
      'Which functions or processes do you outsource that affect OH&S?',
      'What type and degree of control do you apply to outsourced processes?',
      'How do you ensure outsourced processes meet legal and other requirements?',
    ],
    commonNonconformities: [
      'Outsourced processes not identified or not controlled',
      'Degree of control over outsourcing not defined',
    ],
    expectedDocuments: [
      'Outsourcing agreements with OH&S provisions',
      'Outsourced process control / oversight records',
    ],
    crossReferences: ['4.3', '8.1.1', '8.1.4.1', '8.1.4.2'],
  },
  {
    number: '8.2',
    title: 'Emergency preparedness and response',
    parentNumber: '8',
    level: 2,
    requirementText:
      'The organization must establish, implement and maintain processes to prepare for and respond to potential emergency situations identified in 6.1.2, including establishing a planned response, providing training, periodically testing and exercising the response capability, evaluating and revising the response (including after testing and after emergencies), communicating relevant information to workers and interested parties, and taking account of the needs and capabilities of all relevant interested parties.',
    auditFocus: [
      'Potential emergency situations are identified and a planned response established',
      'Emergency response is periodically tested, exercised and revised',
      'Workers and relevant interested parties receive training and information',
      'Lessons from drills and actual emergencies are captured',
    ],
    typicalAuditQuestions: [
      'How did you identify the potential emergency situations you must prepare for?',
      'How often do you test and exercise your emergency response, and what did the last test reveal?',
      'How are workers, contractors and visitors informed of emergency arrangements?',
    ],
    commonNonconformities: [
      'Emergency plans exist but are never tested or exercised',
      'Emergency arrangements not communicated to contractors and visitors',
      'Plans not revised after drills or actual incidents',
    ],
    expectedDocuments: [
      'Emergency response plans',
      'Drill / exercise records and post-drill reviews',
      'Emergency training records',
    ],
    crossReferences: ['6.1.2', '7.3', '7.4', '10.2'],
  },

  // ==========================================================================
  // CLAUSE 9 — PERFORMANCE EVALUATION
  // ==========================================================================
  {
    number: '9',
    title: 'Performance Evaluation',
    level: 1,
    requirementText:
      'The organization must monitor, measure, analyse and evaluate OH&S performance, evaluate compliance, conduct internal audits, and perform management reviews to determine the effectiveness of the OH&S management system.',
    auditFocus: [
      'Performance is measured against objectives and legal requirements',
      'Internal audit and management review drive evaluation and improvement',
    ],
    typicalAuditQuestions: [
      'How do you evaluate the performance and effectiveness of your OH&S system?',
      'How do internal audit and management review feed improvement?',
    ],
    commonNonconformities: [
      'Performance not evaluated against objectives or legal requirements',
      'Internal audit or management review not performed as planned',
    ],
    expectedDocuments: [
      'Monitoring and measurement records',
      'Internal audit reports',
      'Management review minutes',
    ],
    crossReferences: ['9.1', '9.2', '9.3', '10.2'],
  },
  {
    number: '9.1',
    title: 'Monitoring, measurement, analysis and performance evaluation',
    parentNumber: '9',
    level: 2,
    requirementText:
      'The organization must monitor, measure, analyse and evaluate its OH&S performance, determining what needs monitoring, the methods, the criteria, and when monitoring and evaluation are performed, and evaluate compliance with legal and other requirements.',
    auditFocus: [
      'What, how and when monitoring/measurement is performed is defined',
      'Performance is analysed and evaluated, not merely collected',
      'Compliance with legal and other requirements is evaluated',
    ],
    typicalAuditQuestions: [
      'What OH&S parameters do you monitor and measure, and how?',
      'How do you analyse and evaluate the resulting data?',
      'How do you evaluate compliance with applicable legal requirements?',
    ],
    commonNonconformities: [
      'Data collected but not analysed or evaluated',
      'Monitoring methods or criteria not defined',
    ],
    expectedDocuments: [
      'Monitoring and measurement plan',
      'Performance analysis reports',
    ],
    crossReferences: ['6.1.3', '6.2.1', '9.1.1', '9.1.2'],
  },
  {
    number: '9.1.1',
    title: 'General',
    parentNumber: '9.1',
    level: 3,
    requirementText:
      'The organization must determine what needs to be monitored and measured (including the extent of legal/other requirements, activities and operational controls, progress toward objectives, and effectiveness of controls), the methods to ensure valid results, the criteria against which performance is evaluated, and when monitoring and analysis occur; it must ensure monitoring equipment is calibrated or verified as appropriate and retain documented information as evidence.',
    auditFocus: [
      'Monitoring covers controls, objectives, legal compliance and leading/lagging indicators',
      'Methods produce valid, comparable and reproducible results',
      'Monitoring equipment is calibrated or verified where applicable',
      'Documented evidence of results is retained',
    ],
    typicalAuditQuestions: [
      'How do you ensure the validity of your OH&S monitoring results?',
      'How is monitoring equipment calibrated or verified?',
      'What leading and lagging indicators do you track?',
    ],
    commonNonconformities: [
      'Monitoring equipment (e.g. gas detectors, noise meters) not calibrated',
      'Only lagging indicators tracked; no leading indicators',
      'No documented evidence of monitoring results',
    ],
    expectedDocuments: [
      'Calibration certificates / verification records',
      'Monitoring and measurement results',
      'Leading and lagging indicator dashboards',
    ],
    crossReferences: ['6.2.1', '6.2.2', '9.1.2', '9.3'],
  },
  {
    number: '9.1.2',
    title: 'Evaluation of compliance',
    parentNumber: '9.1',
    level: 3,
    requirementText:
      'The organization must establish, implement and maintain processes to evaluate compliance with legal and other requirements, determining the frequency and methods of evaluation, taking action if needed, maintaining knowledge and understanding of its compliance status, and retaining documented information of the compliance evaluation results.',
    auditFocus: [
      'Compliance with each legal and other requirement is periodically evaluated',
      'Frequency and method of evaluation are defined',
      'Action is taken on identified compliance gaps; compliance status is known',
    ],
    typicalAuditQuestions: [
      'How and how often do you evaluate compliance with legal and other requirements?',
      'What did your most recent compliance evaluation conclude?',
      'How do you act on any compliance gaps identified?',
    ],
    commonNonconformities: [
      'No periodic compliance evaluation performed',
      'Compliance evaluation does not cover all identified legal requirements',
      'Compliance gaps identified but no action taken',
    ],
    expectedDocuments: [
      'Compliance evaluation records',
      'Legal compliance register with evaluation status',
    ],
    crossReferences: ['6.1.3', '9.1.1', '9.3', '10.2'],
  },
  {
    number: '9.2',
    title: 'Internal audit',
    parentNumber: '9',
    level: 2,
    requirementText:
      'The organization must conduct internal audits at planned intervals to provide information on whether the OH&S management system conforms to the organization’s own requirements and the standard and is effectively implemented and maintained.',
    auditFocus: [
      'Internal audits are conducted at planned intervals',
      'Audits assess conformity to both the standard and the organization’s own requirements',
      'Audits assess effective implementation, not just documentation',
    ],
    typicalAuditQuestions: [
      'How is your internal audit programme structured and scheduled?',
      'How do internal audits assess effective implementation of the system?',
    ],
    commonNonconformities: [
      'Internal audits not conducted at the planned frequency',
      'Audits check documentation only and not effective implementation',
    ],
    expectedDocuments: [
      'Internal audit programme',
      'Internal audit reports',
    ],
    crossReferences: ['9.2.1', '9.2.2', '10.2'],
  },
  {
    number: '9.2.1',
    title: 'General',
    parentNumber: '9.2',
    level: 3,
    requirementText:
      'The organization must conduct internal audits at planned intervals to provide information on whether the OH&S management system conforms to the organization’s own requirements for its system and to the requirements of the standard, and is effectively implemented and maintained.',
    auditFocus: [
      'Audit scope covers conformity to the organization’s requirements and the standard',
      'Audits confirm effective implementation and maintenance',
      'Audit intervals are planned and risk-based',
    ],
    typicalAuditQuestions: [
      'What are the objectives and criteria of your internal audits?',
      'How do you ensure your internal audits cover the whole system over time?',
      'How do internal audits confirm the system is effectively implemented?',
    ],
    commonNonconformities: [
      'Internal audit scope does not cover all clauses or processes over the cycle',
      'Audits confirm conformity to the standard but not to the organization’s own requirements',
    ],
    expectedDocuments: [
      'Internal audit plans',
      'Internal audit reports with findings',
    ],
    crossReferences: ['9.2.2', '9.3', '10.2'],
  },
  {
    number: '9.2.2',
    title: 'Internal audit program',
    parentNumber: '9.2',
    level: 3,
    requirementText:
      'The organization must plan, establish, implement and maintain an audit programme (including frequency, methods, responsibilities, planning and reporting) that takes into account the importance of the processes and previous audit results; define audit criteria and scope; select competent auditors who are objective and impartial; ensure results are reported to relevant managers and workers; take action to address nonconformities and improve performance; and retain documented information as evidence of the programme and results.',
    auditFocus: [
      'Audit programme reflects process importance and prior results',
      'Auditors are competent, objective and impartial (do not audit their own work)',
      'Results reported to relevant management and workers',
      'Documented evidence of the programme and audit results is retained',
    ],
    typicalAuditQuestions: [
      'How is your audit programme prioritised based on risk and previous results?',
      'How do you ensure internal auditors are competent and impartial?',
      'How are audit results reported to management and workers, and how are findings actioned?',
    ],
    commonNonconformities: [
      'Auditors audited their own area, compromising impartiality',
      'Audit programme not risk-based and ignores previous results',
      'Audit findings not reported to relevant managers or not actioned',
      'No documented evidence of the audit programme or results retained',
    ],
    expectedDocuments: [
      'Audit programme / schedule',
      'Auditor competence records',
      'Audit reports and corrective action records',
    ],
    crossReferences: ['7.2', '7.5.3', '9.2.1', '9.3', '10.2'],
  },
  {
    number: '9.3',
    title: 'Management review',
    parentNumber: '9',
    level: 2,
    requirementText:
      'Top management must review the OH&S management system at planned intervals to ensure its continuing suitability, adequacy and effectiveness, considering defined inputs and producing defined outputs, and retain documented information as evidence of the reviews.',
    auditFocus: [
      'Reviews held at planned intervals by top management',
      'All required inputs are considered and decisions/outputs are recorded',
      'Outputs drive change, resourcing and improvement',
    ],
    typicalAuditQuestions: [
      'How often does top management review the OH&S management system?',
      'What inputs are considered and what decisions resulted from the last review?',
      'How are management review outputs followed through?',
    ],
    commonNonconformities: [
      'Management review not conducted at planned intervals',
      'Required inputs missing from the review',
      'Review produces no decisions or actions',
    ],
    expectedDocuments: [
      'Management review minutes / records',
      'Management review input and output documentation',
    ],
    crossReferences: ['9.3.1', '9.3.2', '9.3.3', '10.3'],
  },
  {
    number: '9.3.1',
    title: 'General',
    parentNumber: '9.3',
    level: 3,
    requirementText:
      'Top management must review the organization’s OH&S management system at planned intervals to ensure its continuing suitability, adequacy and effectiveness in achieving the intended outcomes.',
    auditFocus: [
      'Review is conducted by top management at planned intervals',
      'Review explicitly addresses suitability, adequacy and effectiveness',
    ],
    typicalAuditQuestions: [
      'Who participates in the management review and how is top management involved?',
      'How does the review address the suitability, adequacy and effectiveness of the system?',
    ],
    commonNonconformities: [
      'Management review conducted without top management involvement',
      'Review does not address suitability, adequacy and effectiveness',
    ],
    expectedDocuments: [
      'Management review schedule',
      'Management review attendance records',
    ],
    crossReferences: ['5.1', '9.3.2', '9.3.3'],
  },
  {
    number: '9.3.2',
    title: 'Management review inputs',
    parentNumber: '9.3',
    level: 3,
    requirementText:
      'The management review must consider the status of actions from previous reviews; changes in external and internal issues relevant to the system (including interested-party needs, legal/other requirements, and risks and opportunities); the extent to which the policy and objectives have been met; information on OH&S performance (including incidents, nonconformities and corrective actions, monitoring results, compliance evaluation, audit results, worker consultation and participation, and risks and opportunities); the adequacy of resources; relevant communications with interested parties; and opportunities for continual improvement.',
    auditFocus: [
      'All mandatory inputs are present in the review',
      'Inputs include incidents, audit results, compliance status and worker consultation',
      'Resource adequacy and improvement opportunities are considered',
    ],
    typicalAuditQuestions: [
      'Which inputs were considered in your last management review?',
      'How were incident trends, audit results and compliance status presented?',
      'How was worker consultation and participation reflected in the review inputs?',
    ],
    commonNonconformities: [
      'One or more required inputs (e.g. compliance evaluation, worker consultation) omitted',
      'Inputs presented as raw data without analysis',
    ],
    expectedDocuments: [
      'Management review input pack / agenda',
      'Performance and incident data presented to the review',
    ],
    crossReferences: ['9.1.1', '9.1.2', '9.2.2', '9.3.1', '9.3.3'],
  },
  {
    number: '9.3.3',
    title: 'Management review results',
    parentNumber: '9.3',
    level: 3,
    requirementText:
      'The outputs of the management review must include decisions related to the continuing suitability, adequacy and effectiveness of the system in achieving its intended outcomes; opportunities for continual improvement; any need for changes to the system; resource needs; actions where objectives have not been achieved; opportunities to improve integration with other business processes; and any implications for the strategic direction; relevant outputs must be communicated to workers and worker representatives.',
    auditFocus: [
      'Review outputs include decisions on improvement, change, resources and objectives',
      'Relevant outputs are communicated to workers and their representatives',
      'Actions arising from the review are tracked to completion',
    ],
    typicalAuditQuestions: [
      'What decisions and actions resulted from your last management review?',
      'How were relevant review outputs communicated to workers?',
      'How do you track management review actions to closure?',
    ],
    commonNonconformities: [
      'Review records lack decisions, actions or resource commitments',
      'Outputs not communicated to workers or their representatives',
      'Actions from the review not tracked or not completed',
    ],
    expectedDocuments: [
      'Management review output / action log',
      'Communication of review outcomes to workers',
    ],
    crossReferences: ['7.1', '9.3.2', '10.1', '10.3'],
  },

  // ==========================================================================
  // CLAUSE 10 — IMPROVEMENT
  // ==========================================================================
  {
    number: '10',
    title: 'Improvement',
    level: 1,
    requirementText:
      'The organization must determine opportunities for improvement and implement actions to achieve the intended outcomes of the OH&S management system, including managing incidents and nonconformities and continually improving the system.',
    auditFocus: [
      'Improvement opportunities are identified and acted upon',
      'Incidents and nonconformities lead to effective corrective action',
    ],
    typicalAuditQuestions: [
      'How do you identify and act on opportunities to improve OH&S performance?',
      'How do incidents and nonconformities drive improvement?',
    ],
    commonNonconformities: [
      'No process to identify or act on improvement opportunities',
      'Nonconformities recur because corrective action is ineffective',
    ],
    expectedDocuments: [
      'Incident and nonconformity records',
      'Continual improvement records',
    ],
    crossReferences: ['10.1', '10.2', '10.3'],
  },
  {
    number: '10.1',
    title: 'General',
    parentNumber: '10',
    level: 2,
    requirementText:
      'The organization must determine opportunities for improvement and implement necessary actions to achieve the intended outcomes of its OH&S management system, including improving OH&S performance, promoting a positive OH&S culture, and supporting worker participation in implementing improvement actions.',
    auditFocus: [
      'Opportunities for improvement are determined across the system',
      'Improvement actions enhance performance and culture',
      'Worker participation supports improvement',
    ],
    typicalAuditQuestions: [
      'How do you determine opportunities for improvement?',
      'How are workers involved in implementing improvement actions?',
      'How do improvement actions strengthen your OH&S culture?',
    ],
    commonNonconformities: [
      'Improvement is reactive only, with no proactive identification of opportunities',
      'Workers not engaged in improvement actions',
    ],
    expectedDocuments: [
      'Improvement opportunity register',
      'Improvement action records',
    ],
    crossReferences: ['9.3.3', '10.2', '10.3'],
  },
  {
    number: '10.2',
    title: 'Incident, nonconformity and corrective action',
    parentNumber: '10',
    level: 2,
    requirementText:
      'The organization must establish processes to report, investigate and act on incidents and nonconformities by reacting promptly and controlling/correcting them and dealing with consequences; evaluating with worker participation the need for corrective action to eliminate root causes and prevent recurrence (including reviewing the incident/nonconformity, determining causes, and checking whether similar ones exist or could occur); implementing needed actions including, where appropriate, updating risks and opportunities; reviewing the effectiveness of corrective actions; and making changes to the system if necessary, ensuring corrective actions are appropriate to the effects encountered; documented information must be retained as evidence of the nature of incidents/nonconformities, actions taken, and results including effectiveness.',
    auditFocus: [
      'Incidents and nonconformities are reported, investigated and corrected promptly',
      'Root cause analysis is performed with worker participation',
      'Corrective actions address root causes and prevent recurrence, and their effectiveness is reviewed',
      'Documented evidence of incidents, actions and effectiveness is retained',
    ],
    typicalAuditQuestions: [
      'Walk me through how a recent incident or nonconformity was investigated and resolved.',
      'How do you perform root cause analysis and involve workers?',
      'How do you verify that corrective actions were effective and prevented recurrence?',
    ],
    commonNonconformities: [
      'Corrections made but root cause not addressed, leading to recurrence',
      'Corrective action effectiveness never reviewed',
      'Workers not involved in incident investigation',
      'Incomplete records of incidents and the actions taken',
    ],
    expectedDocuments: [
      'Incident reports and investigation records',
      'Nonconformity and corrective action register',
      'Root cause analysis and effectiveness review records',
    ],
    crossReferences: ['5.4', '6.1.2', '8.1.3', '9.1.1', '10.3'],
  },
  {
    number: '10.3',
    title: 'Continual improvement',
    parentNumber: '10',
    level: 2,
    requirementText:
      'The organization must continually improve the suitability, adequacy and effectiveness of the OH&S management system by enhancing OH&S performance, promoting a culture supporting the system, promoting worker participation in implementing continual improvement, and communicating the relevant results of continual improvement to workers and their representatives; documented information must be retained as evidence of continual improvement.',
    auditFocus: [
      'Demonstrable trend of improving suitability, adequacy and effectiveness',
      'A positive OH&S culture and worker participation support improvement',
      'Results of continual improvement are communicated to workers and representatives',
    ],
    typicalAuditQuestions: [
      'How do you demonstrate continual improvement of your OH&S system over time?',
      'How is worker participation embedded in continual improvement?',
      'How are improvement results communicated to workers and their representatives?',
    ],
    commonNonconformities: [
      'No evidence of continual improvement over successive periods',
      'Improvement results not communicated to workers',
      'Continual improvement claimed but not supported by documented evidence',
    ],
    expectedDocuments: [
      'Trend analysis of OH&S performance',
      'Continual improvement records and communications',
    ],
    crossReferences: ['4.4', '9.3.3', '10.1', '10.2'],
  },
];
