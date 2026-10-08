import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ROLE_RATES,
  calculateTask,
  calculateModule,
  calculateEstimate,
  validateEstimateRules,
  type ModuleInput,
} from './costing.ts';

describe('Costing Calculation & Business Rules', () => {
  it('should have exact default role rates matching spreadsheet', () => {
    assert.equal(DEFAULT_ROLE_RATES.PM, 39602);
    assert.equal(DEFAULT_ROLE_RATES.WEB_DEV, 39602);
    assert.equal(DEFAULT_ROLE_RATES.UI_UX, 33113);
    assert.equal(DEFAULT_ROLE_RATES.QC_DOC, 33101);
    assert.equal(DEFAULT_ROLE_RATES.DEV_OPS, 43760);
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
    assert.equal(estimate.modules[5].total_cost, 333448);   // 6.0 Configuration
    assert.equal(estimate.modules[6].total_cost, 658580);   // 7.0 Coordination
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
    assert.equal(estimate.cost_by_role.dev_ops, 437600);

    // Grand total cost matching spreadsheet exactly
    assert.equal(estimate.total_cost, 7717782);
  });

  it('should calculate Maintenance website costing correctly (Rp 491.856)', () => {
    const maintenanceModule = calculateModule({
      name: 'Maintenance Tasks',
      tasks: [
        { name: 'Dev Ops (Manhour)', hours_pm: 0, hours_web_dev: 0, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 4 },
        { name: 'Web Programmer (Manhour)', hours_pm: 0, hours_web_dev: 8, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
      ],
    });

    assert.equal(maintenanceModule.cost_breakdown.dev_ops, 175040); // 4 * 43760
    assert.equal(maintenanceModule.cost_breakdown.web_dev, 316816);  // 8 * 39602
    assert.equal(maintenanceModule.total_cost, 491856);
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
});
