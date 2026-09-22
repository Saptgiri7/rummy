import { test, expect } from '@playwright/test';

test.describe('Concrete Authentication (Email/Phone + OTP) & Admin Dashboard Flow', () => {
  test('User registers with Phone & OTP, logs out, and Admin logs in to inspect Analytics Dashboard', async ({ page }) => {
    // 1. Load application and wait for initial session to settle
    await page.goto('/');
    await expect(page.locator('.user-badge')).toContainText('Player_', { timeout: 15000 });
    await expect(page.locator('#btn-nav-register')).toBeVisible();

    // 2. Open Sign Up modal
    await page.click('#btn-nav-register');
    await expect(page.locator('.auth-modal-card')).toBeVisible();

    // 3. Switch to Mobile Phone registration
    await page.click('button:has-text("📱 Mobile Phone")');

    const uniquePhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
    const uniqueUser = `User_${Date.now().toString().slice(-5)}`;

    await page.fill('#reg-username', uniqueUser);
    await page.fill('#reg-identifier', uniquePhone);
    await page.fill('#reg-password', 'SecurePass123!');

    // 4. Send Verification OTP
    await page.click('#btn-send-otp');

    // 5. Verify OTP step is shown
    await expect(page.locator('#btn-verify-otp')).toBeVisible({ timeout: 10000 });

    // In dev mode, the dev-otp-badge provides the 6-digit code
    await expect(page.locator('.dev-otp-badge')).toBeVisible();
    const devOtpText = (await page.locator('.dev-otp-badge code').textContent())?.trim();
    expect(devOtpText).toBeDefined();
    expect(devOtpText!.length).toBe(6);

    // Fill digits
    for (let i = 0; i < 6; i++) {
      await page.fill(`#otp-input-${i}`, devOtpText![i]!);
    }

    // Submit OTP verification
    await page.click('#btn-verify-otp');

    // Modal closes and user is registered & verified
    await expect(page.locator('.auth-modal-card')).not.toBeVisible();
    await expect(page.locator('#btn-nav-logout')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.user-badge')).toContainText(uniqueUser);

    // 6. Log out
    await page.click('#btn-nav-logout');
    await expect(page.locator('.user-badge')).toContainText('Player_', { timeout: 10000 });

    // 7. Log in as Administrator
    await expect(page.locator('#btn-nav-login')).toBeVisible({ timeout: 10000 });
    await page.click('#btn-nav-login');
    await expect(page.locator('.auth-modal-card')).toBeVisible();

    await page.fill('#login-identifier', 'admin');
    await page.fill('#login-password', 'AdminPassword123!');
    await page.click('#btn-auth-login');

    await expect(page.locator('.auth-modal-card')).not.toBeVisible();

    // 8. Verify Admin controls are present
    await expect(page.locator('#btn-admin-portal')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.role-tag-gold')).toHaveText('ADMIN');

    // 9. Open Admin Dashboard
    await page.click('#btn-admin-portal');
    await expect(page.locator('.admin-title')).toContainText('Platform Command & Analytics');
    await expect(page.locator('.kpi-card')).toHaveCount(6);
    await expect(page.locator('.admin-data-table')).toBeVisible();

    // 10. Exit Admin Dashboard back to Table Lobby
    await page.click('button:has-text("← Back to Table")');
    await expect(page.locator('#btn-create-table')).toBeVisible();
  });
});
