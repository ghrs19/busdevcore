import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ROLE_RATES,
  calculateTask,
  calculateModule,
  calculateEstimate,
  validateEstimateRules,
  normalizeRoleSnapshot,
  calculateMaintenance,
  calculateInfrastructure,
  type ModuleInput,
} from './costing.ts';

describe('Costing Calculation & Business Rules', () => {
  it('should have exact default role rates matching spreadsheet', () => {
    assert.equal(DEFAULT_ROLE_RATES.PM, 39602);
    assert.equal(DEFAULT_ROLE_RATES.WEB_DEV, 39602);
    assert.equal(DEFAULT_ROLE_RATES.UI_UX, 33113);
    assert.equal(DEFAULT_ROLE_RATES.QC_DOC, 33101);
    assert.equal(DEFAULT_ROLE_RATES.DEV_OPS, 47261);
  });

  it('should calculate individual task cost correctly', () => {
    // Kickoff: PM: 2, WEB DEV: 2, UI-UX: 2
    const task = calculateTask({
      name: 'Kickoff Meeting',
      hours_pm: 2,
      hours_web_dev: 2,
      hours_ui_ux: 2,
      hours_qc_doc: 0,
      hours_dev_ops: 0,
    });

    assert.equal(task.total_hours, 6);
    // 2*39602 + 2*39602 + 2*33113 = 79204 + 79204 + 66226 = 224634
    assert.equal(task.total_cost, 224634);
    assert.equal(task.cost_breakdown.pm, 79204);
    assert.equal(task.cost_breakdown.web_dev, 79204);
    assert.equal(task.cost_breakdown.ui_ux, 66226);
  });

  it('should replicate the exact spreadsheet calculation (204 manhours, Rp 7.717.782 total cost)', () => {
    const modules: ModuleInput[] = [
      {
        name: '1.0 Coordination',
        tasks: [
          { name: 'Kickoff Project Meeting (1x)', hours_pm: 2, hours_web_dev: 2, hours_ui_ux: 2, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Client Meeting (2x)', hours_pm: 4, hours_web_dev: 4, hours_ui_ux: 4, hours_qc_doc: 0, hours_dev_ops: 0 },
        ],
      },
      {
        name: '2.0 Scrum',
        tasks: [
          { name: 'Scrum Definition', hours_pm: 2, hours_web_dev: 0, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Scrum Monitoring', hours_pm: 2, hours_web_dev: 0, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
        ],
      },
      {
        name: '3.0 Backend',
        tasks: [
          { name: 'Project Setup & Model Definition', hours_pm: 0, hours_web_dev: 4, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
        ],
      },
      {
        name: '4.0 Frontend',
        tasks: [
          { name: 'Registration Flow', hours_pm: 4, hours_web_dev: 4, hours_ui_ux: 4, hours_qc_doc: 8, hours_dev_ops: 0 },
          { name: 'Mini Games Activation', hours_pm: 0, hours_web_dev: 24, hours_ui_ux: 16, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Voucher/Coupon Flow', hours_pm: 0, hours_web_dev: 8, hours_ui_ux: 4, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Redeem Flow', hours_pm: 0, hours_web_dev: 8, hours_ui_ux: 4, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Profile', hours_pm: 0, hours_web_dev: 4, hours_ui_ux: 4, hours_qc_doc: 0, hours_dev_ops: 0 },
        ],
      },
      {
        name: '5.0 Backend',
        tasks: [
          { name: 'User Management', hours_pm: 4, hours_web_dev: 4, hours_ui_ux: 0, hours_qc_doc: 8, hours_dev_ops: 0 },
          { name: 'Outlet Management', hours_pm: 0, hours_web_dev: 4, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Voucher/Coupon Management', hours_pm: 0, hours_web_dev: 8, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Redeem Management', hours_pm: 0, hours_web_dev: 8, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Dashboard & Reporting', hours_pm: 0, hours_web_dev: 4, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
        ],
      },
      {
        name: '6.0 Configuration',
        tasks: [
          { name: 'Domain Setup', hours_pm: 0, hours_web_dev: 0, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 2 },
          { name: 'Facebook Pixel Setup', hours_pm: 0, hours_web_dev: 2, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Mail SMTP Setup', hours_pm: 0, hours_web_dev: 0, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 2 },
          { name: 'Installation Security Module', hours_pm: 0, hours_web_dev: 2, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
        ],
      },
      {
        name: '7.0 Coordination',
        tasks: [
          { name: 'Preview Project Meeting', hours_pm: 2, hours_web_dev: 2, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 2 },
          { name: 'Feedback Meeting', hours_pm: 4, hours_web_dev: 2, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 4 },
        ],
      },
      {
        name: '8.0 Content',
        tasks: [
          { name: 'Upload Content', hours_pm: 0, hours_web_dev: 8, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
        ],
      },
      {
        name: '9.0 Testing & Production',
        tasks: [
          { name: 'Final Testing & Training', hours_pm: 0, hours_web_dev: 0, hours_ui_ux: 0, hours_qc_doc: 8, hours_dev_ops: 0 },
          { name: 'Deployment', hours_pm: 0, hours_web_dev: 4, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Scrum Monitoring', hours_pm: 2, hours_web_dev: 0, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
        ],
      },
    ];

    const estimate = calculateEstimate({
      title: 'Djarum Urban - Microsite MVP',
      serviceTypeCode: 'IT',
      categoryCode: 'DEVELOPMENT',
      tagCode: 'INITIAL',
      modules,
    });

    // Check individual module costs from spreadsheet
    assert.equal(estimate.modules[0].total_cost, 673902);   // 1.0 Coordination
    assert.equal(estimate.modules[1].total_cost, 158408);   // 2.0 Scrum
    assert.equal(estimate.modules[2].total_cost, 158408);   // 3.0 Backend
    assert.equal(estimate.modules[3].total_cost, 3383728);  // 4.0 Frontend
    assert.equal(estimate.modules[4].total_cost, 1532072);  // 5.0 Backend
    assert.equal(estimate.modules[5].total_cost, 347452);   // 6.0 Configuration
    assert.equal(estimate.modules[6].total_cost, 679586);   // 7.0 Coordination
    assert.equal(estimate.modules[7].total_cost, 316816);   // 8.0 Content
    assert.equal(estimate.modules[8].total_cost, 502420);   // 9.0 Testing & Production

    // Check hours per role
    assert.equal(estimate.hours_by_role.pm, 26);
    assert.equal(estimate.hours_by_role.web_dev, 106);
    assert.equal(estimate.hours_by_role.ui_ux, 38);
    assert.equal(estimate.hours_by_role.qc_doc, 24);
    assert.equal(estimate.hours_by_role.dev_ops, 10);
    assert.equal(estimate.total_hours, 204);

    // Check cost per role
    assert.equal(estimate.cost_by_role.pm, 1029652);
    assert.equal(estimate.cost_by_role.web_dev, 4197812);
    assert.equal(estimate.cost_by_role.ui_ux, 1258294);
    assert.equal(estimate.cost_by_role.qc_doc, 794424);
    assert.equal(estimate.cost_by_role.dev_ops, 472610);

    // Grand total cost matching spreadsheet exactly
    assert.equal(estimate.total_cost, 7752792);
  });

  it('should calculate Maintenance website costing correctly (Rp 491.856)', () => {
    const maintenanceModule = calculateModule({
      name: 'Maintenance Tasks',
      tasks: [
        { name: 'Dev Ops (Manhour)', hours_pm: 0, hours_web_dev: 0, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 4 },
        { name: 'Web Programmer (Manhour)', hours_pm: 0, hours_web_dev: 8, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
      ],
    });

    assert.equal(maintenanceModule.cost_breakdown.dev_ops, 189044); // 4 * 47261
    assert.equal(maintenanceModule.cost_breakdown.web_dev, 316816);  // 8 * 39602
    assert.equal(maintenanceModule.total_cost, 505860);
    assert.equal(maintenanceModule.total_hours, 12);
  });

  it('should validate business rules: Development requires Tag (Initial / CR)', () => {
    const resNoTag = validateEstimateRules({
      serviceTypeCode: 'IT',
      categoryCode: 'DEVELOPMENT',
      tagCode: null,
    });
    assert.equal(resNoTag.valid, false);
    assert.match(resNoTag.errors[0], /wajib memilih Tag/i);

    const resWithTag = validateEstimateRules({
      serviceTypeCode: 'IT',
      categoryCode: 'DEVELOPMENT',
      tagCode: 'INITIAL',
    });
    assert.equal(resWithTag.valid, true);

    const resWithCR = validateEstimateRules({
      serviceTypeCode: 'IT',
      categoryCode: 'DEVELOPMENT',
      tagCode: 'CR',
    });
    assert.equal(resWithCR.valid, true);
  });

  it('should validate business rules: Maintenance forbids Tag', () => {
    const resMaintenanceWithTag = validateEstimateRules({
      serviceTypeCode: 'IT',
      categoryCode: 'MAINTENANCE',
      tagCode: 'INITIAL',
    });
    assert.equal(resMaintenanceWithTag.valid, false);
    assert.match(resMaintenanceWithTag.errors[0], /tidak boleh memiliki Tag/i);

    const resMaintenanceValid = validateEstimateRules({
      serviceTypeCode: 'IT',
      categoryCode: 'MAINTENANCE',
      tagCode: null,
    });
    assert.equal(resMaintenanceValid.valid, true);
  });

  it('should reject reserved Digital service type', () => {
    const resDigital = validateEstimateRules({
      serviceTypeCode: 'DIGITAL',
      categoryCode: 'DEVELOPMENT',
      tagCode: 'INITIAL',
    });
    assert.equal(resDigital.valid, false);
    assert.match(resDigital.errors[0], /reserved/i);
  });

  it('should support snapshot rates independently of default rates', () => {
    const customRates = {
      PM: 50000,
      WEB_DEV: 50000,
      UI_UX: 40000,
      QC_DOC: 40000,
      DEV_OPS: 60000,
    };

    const estimate = calculateEstimate({
      title: 'Custom Rate Estimate',
      serviceTypeCode: 'IT',
      categoryCode: 'DEVELOPMENT',
      tagCode: 'CR',
      rates: customRates,
      modules: [
        {
          name: 'Sprint 1',
          tasks: [
            { name: 'Task 1', hours_pm: 10, hours_web_dev: 10, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
          ],
        },
      ],
    });

    assert.equal(estimate.total_cost, 1000000); // 10*50000 + 10*50000
    assert.equal(estimate.rates.PM, 50000);
  });

  it('should support dynamic arbitrary roles in task and estimate calculation', () => {
    const customRates = {
      PM: 40000,
      WEB_DEV: 40000,
      MOBILE_DEV: 60000,
      AI_ENGINEER: 100000,
    };

    const task = calculateTask(
      {
        name: 'AI Integration',
        role_hours: {
          PM: 2,
          MOBILE_DEV: 10,
          AI_ENGINEER: 5,
        },
      },
      customRates
    );

    assert.equal(task.total_hours, 17);
    // 2*40000 + 10*60000 + 5*100000 = 80000 + 600000 + 500000 = 1180000
    assert.equal(task.total_cost, 1180000);
    assert.equal(task.cost_breakdown.MOBILE_DEV, 600000);
    assert.equal(task.cost_breakdown.AI_ENGINEER, 500000);

    const estimate = calculateEstimate({
      title: 'Dynamic Roles Project',
      serviceTypeCode: 'IT',
      categoryCode: 'DEVELOPMENT',
      tagCode: 'INITIAL',
      rates: customRates,
      modules: [
        {
          name: 'Core & AI',
          tasks: [
            task,
          ],
        },
      ],
    });

    assert.equal(estimate.total_hours, 17);
    assert.equal(estimate.total_cost, 1180000);
    assert.equal(estimate.hours_by_role.MOBILE_DEV, 10);
    assert.equal(estimate.hours_by_role.AI_ENGINEER, 5);
    assert.equal(estimate.cost_by_role.MOBILE_DEV, 600000);
    assert.equal(estimate.cost_by_role.AI_ENGINEER, 500000);
  });

  it('should validate multi-categories: Dev + Infra requires Tag (Initial / CR)', () => {
    const resNoTag = validateEstimateRules({
      serviceTypeCode: 'IT',
      categoryCodes: ['DEVELOPMENT', 'INFRASTRUCTURE'],
      tagCode: null,
    });
    assert.equal(resNoTag.valid, false);
    assert.match(resNoTag.errors[0], /wajib memilih Tag/i);

    const resWithTag = validateEstimateRules({
      serviceTypeCode: 'IT',
      categoryCodes: ['DEVELOPMENT', 'INFRASTRUCTURE'],
      tagCode: 'INITIAL',
    });
    assert.equal(resWithTag.valid, true);

    const resWithCR = validateEstimateRules({
      serviceTypeCode: 'IT',
      categoryCodes: ['DEVELOPMENT', 'MAINTENANCE', 'INFRASTRUCTURE'],
      tagCode: 'CR',
    });
    assert.equal(resWithCR.valid, true);
  });

  it('should validate multi-categories: Maintenance + Infra forbids Tag', () => {
    const resWithTag = validateEstimateRules({
      serviceTypeCode: 'IT',
      categoryCodes: ['MAINTENANCE', 'INFRASTRUCTURE'],
      tagCode: 'INITIAL',
    });
    assert.equal(resWithTag.valid, false);
    assert.match(resWithTag.errors[0], /tidak boleh memiliki Tag/i);

    const resWithoutTag = validateEstimateRules({
      serviceTypeCode: 'IT',
      categoryCodes: ['MAINTENANCE', 'INFRASTRUCTURE'],
      tagCode: null,
    });
    assert.equal(resWithoutTag.valid, true);
  });

  it('should validate single Infrastructure category forbids Tag', () => {
    const resInfraWithTag = validateEstimateRules({
      serviceTypeCode: 'IT',
      categoryCodes: ['INFRASTRUCTURE'],
      tagCode: 'INITIAL',
    });
    assert.equal(resInfraWithTag.valid, false);

    const resInfraValid = validateEstimateRules({
      serviceTypeCode: 'IT',
      categoryCodes: ['INFRASTRUCTURE'],
      tagCode: null,
    });
    assert.equal(resInfraValid.valid, true);
  });

  // NEW REQUIREMENTS TESTS

  it('should support full independent rate snapshots (code, name, rate) and backward compatibility with number format', () => {
    // 1. Full snapshot format
    const fullSnapshot = {
      DEV_OPS: { code: 'DEV_OPS', name: 'DevOps Specialist', rate: 50000 },
      QA: { code: 'QA', name: 'Quality Assurance', rate: 40000 },
    };
    const normalized = normalizeRoleSnapshot(fullSnapshot);
    assert.equal(normalized.DEV_OPS.name, 'DevOps Specialist');
    assert.equal(normalized.DEV_OPS.rate, 50000);
    assert.equal(normalized.QA.name, 'Quality Assurance');
    assert.equal(normalized.QA.rate, 40000);

    // 2. Legacy number map format
    const legacySnapshot = {
      DEV_OPS: 45000,
      CUSTOM_ROLE: 60000,
    };
    const normalizedLegacy = normalizeRoleSnapshot(legacySnapshot);
    assert.equal(normalizedLegacy.DEV_OPS.name, 'DevOps Engineer'); // Resolved from DEFAULT_ROLE_NAMES
    assert.equal(normalizedLegacy.DEV_OPS.rate, 45000);
    assert.equal(normalizedLegacy.CUSTOM_ROLE.name, 'CUSTOM_ROLE'); // Fallback to key
    assert.equal(normalizedLegacy.CUSTOM_ROLE.rate, 60000);
  });

  it('should calculate Maintenance WBS (monthly rate x contract duration = total cost)', () => {
    const maintenanceConfig = {
      duration_months: 6,
      tasks: [
        {
          name: 'Routine Server & Security Patches',
          role_hours: { DEV_OPS: 4 },
        },
        {
          name: 'Web Bug Fixing & Content Update',
          role_hours: { WEB_DEV: 8 },
        },
      ],
    };

    const calculated = calculateMaintenance(maintenanceConfig);
    assert.equal(calculated.duration_months, 6);
    assert.equal(calculated.total_monthly_hours, 12);
    // 4 * 47261 (189044) + 8 * 39602 (316816) = 505860/month
    assert.equal(calculated.monthly_cost, 505860);
    // 491856 * 6 months = 2951136
    assert.equal(calculated.total_cost, 505860 * 6);
    assert.equal(calculated.hours_by_role.DEV_OPS, 4);
    assert.equal(calculated.hours_by_role.WEB_DEV, 8);
  });

  it('should calculate Infrastructure WBS (ONE_TIME setup vs MONTHLY/YEARLY recurring)', () => {
    const infraItems = [
      {
        name: 'Beli Router Mikrotik',
        billing_type: 'ONE_TIME' as const,
        quantity: 1,
        unit_cost: 2500000,
        period_count: 1,
      },
      {
        name: 'Jasa Pasang Jaringan & Kabel',
        billing_type: 'ONE_TIME' as const,
        quantity: 1,
        unit_cost: 1500000,
        period_count: 1,
      },
      {
        name: 'Cloud VPS Hosting High Memory',
        billing_type: 'MONTHLY' as const,
        quantity: 1,
        unit_cost: 450000,
        period_count: 12,
      },
      {
        name: 'Domain .com / .id',
        billing_type: 'YEARLY' as const,
        quantity: 1,
        unit_cost: 250000,
        period_count: 1,
      },
    ];

    const calculated = calculateInfrastructure(infraItems);
    // One time: 2.500.000 + 1.500.000 = 4.000.000
    assert.equal(calculated.one_time_subtotal, 4000000);
    // Recurring: (450.000 * 12 = 5.400.000) + (250.000 * 1 = 250.000) = 5.650.000
    assert.equal(calculated.recurring_subtotal, 5650000);
    // Grand total = 4.000.000 + 5.650.000 = 9.650.000
    assert.equal(calculated.grand_total, 9650000);
  });

  it('should calculate combined multi-billing summary across Dev, Maintenance, and Infrastructure', () => {
    const estimate = calculateEstimate({
      title: 'Full Stack Project: Dev + Maint + Infra',
      serviceTypeCode: 'IT',
      categoryCodes: ['DEVELOPMENT', 'MAINTENANCE', 'INFRASTRUCTURE'],
      tagCode: 'INITIAL',
      modules: [
        {
          name: 'MVP Module',
          tasks: [
            { name: 'Core Feature', hours_pm: 10, hours_web_dev: 10 },
          ],
        },
      ],
      maintenance: {
        duration_months: 12,
        tasks: [
          { name: 'Monthly Support', role_hours: { DEV_OPS: 4, WEB_DEV: 8 } },
        ],
      },
      infrastructure: [
        { name: 'Router Mikrotik', billing_type: 'ONE_TIME', quantity: 1, unit_cost: 2500000 },
        { name: 'Cloud VPS', billing_type: 'MONTHLY', quantity: 1, unit_cost: 450000, period_count: 12 },
      ],
    });

    // Dev one-time: 10*39602 + 10*39602 = 792040
    assert.equal(estimate.billing_summary.one_time_dev, 792040);
    // Infra one-time: 2500000
    assert.equal(estimate.billing_summary.one_time_infra, 2500000);
    // Total one-time: 792040 + 2500000 = 3292040
    assert.equal(estimate.billing_summary.total_one_time, 3292040);

    // Maintenance: 491856/bln, total 12 bln = 5902272
    assert.equal(estimate.billing_summary.monthly_maintenance, 505860);
    assert.equal(estimate.billing_summary.total_maintenance, 505860 * 12);

    // Infra recurring: 450000 * 12 = 5400000
    assert.equal(estimate.billing_summary.recurring_infra, 5400000);
    assert.equal(estimate.billing_summary.monthly_infra, 450000);

    // Grand total: 3292040 + 5902272 + 5400000 = 14762360
    assert.equal(estimate.billing_summary.grand_total, 14762360);
    assert.equal(estimate.total_cost, 14762360);
  });
});
