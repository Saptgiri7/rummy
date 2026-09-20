import { test, expect } from '@playwright/test';

test.describe('13-Card Indian Rummy Multiplayer Browser E2E Flow', () => {
  test('Host creates room, friend joins via room code, auto-starts on capacity, and executes turns', async ({ browser }) => {
    // Create two isolated browser contexts to simulate two separate players
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const pageHost = await hostContext.newPage();
    const pageGuest = await guestContext.newPage();

    pageHost.on('console', (msg) => console.log('[HOST BROWSER]', msg.text()));
    pageGuest.on('console', (msg) => console.log('[GUEST BROWSER]', msg.text()));

    pageHost.on('pageerror', (err) => console.error('[HOST PAGEERROR]', err));
    pageGuest.on('pageerror', (err) => console.error('[GUEST PAGEERROR]', err));

    // 1. Host loads the platform
    await pageHost.goto('/');
    await expect(pageHost.locator('#btn-create-table')).toBeVisible({ timeout: 15000 });

    // 2. Host clicks "Create Table", selects 2-players, and creates room
    await pageHost.click('#btn-create-table');
    await expect(pageHost.locator('#btn-confirm-create-room')).toBeVisible();
    await pageHost.click('#btn-confirm-create-room');

    // 3. Host is in Waiting Lobby and receives 6-character room code
    await expect(pageHost.locator('.room-code-text')).toBeVisible({ timeout: 10000 });
    const roomCodeText = (await pageHost.locator('.room-code-text').textContent())?.trim();
    expect(roomCodeText).toBeDefined();
    expect(roomCodeText!.length).toBe(6);
    expect(roomCodeText).toMatch(/^RUM[A-Z0-9]{3}$/);

    // 4. Friend / Guest loads the platform
    await pageGuest.goto('/');
    await expect(pageGuest.locator('#btn-join-with-code')).toBeVisible({ timeout: 15000 });

    // 5. Friend clicks "Join with Code", enters the 6-character code, and submits
    await pageGuest.click('#btn-join-with-code');
    await expect(pageGuest.locator('#input-room-code')).toBeVisible();
    await pageGuest.fill('#input-room-code', roomCodeText!);
    await pageGuest.click('#btn-confirm-join-room');

    // 6. As soon as 2nd player joins 2-player room, BOTH players must transition to Game Table
    await expect(pageHost.locator('[data-testid="game-table"]')).toBeVisible({ timeout: 15000 });
    await expect(pageGuest.locator('[data-testid="game-table"]')).toBeVisible({ timeout: 15000 });

    // 7. Verify Turn Indicators on both screens
    const hostBanner = pageHost.locator('#turn-status-banner');
    const guestBanner = pageGuest.locator('#turn-status-banner');

    await expect(hostBanner).toBeVisible();
    await expect(guestBanner).toBeVisible();

    // Exactly one player should have active turn, other should be waiting
    await Promise.race([
      pageHost.locator('#turn-status-banner.my-turn').waitFor({ timeout: 10000 }),
      pageGuest.locator('#turn-status-banner.my-turn').waitFor({ timeout: 10000 })
    ]);

    const isHostActive = await pageHost.locator('#turn-status-banner.my-turn').isVisible();
    const activePage = isHostActive ? pageHost : pageGuest;
    const waitingPage = isHostActive ? pageGuest : pageHost;

    await expect(activePage.locator('#turn-status-banner')).toContainText('YOUR TURN');
    await expect(activePage.locator('#turn-status-banner')).toContainText('Draw a card');
    await expect(waitingPage.locator('#turn-status-banner')).toContainText('WAITING');

    // 8. Active player draws from Closed Deck
    const closedDeck = activePage.locator('#closed-draw-deck');
    await expect(closedDeck).toHaveClass(/can-draw-pulse/);
    await closedDeck.click({ force: true });

    // 9. Active player transitions to Discard phase
    await expect(activePage.locator('#turn-status-banner')).toContainText('Select 1 card from your hand');

    // 10. Active player selects 1 card from hand
    const handCard = activePage.locator('.meld-groups-wrapper .rummy-card').first();
    await handCard.click();

    // 11. Discard button activates and active player clicks Discard
    const discardBtn = activePage.locator('#btn-discard-card');
    await expect(discardBtn).toBeEnabled({ timeout: 5000 });
    await discardBtn.click({ force: true });

    // 12. Turn Handover: Now the previously waiting player receives active turn!
    await expect(waitingPage.locator('#turn-status-banner.my-turn')).toBeVisible({ timeout: 10000 });
    await expect(waitingPage.locator('#turn-status-banner')).toContainText('YOUR TURN');
    await expect(activePage.locator('#turn-status-banner')).toContainText('WAITING');

    // Clean up
    await hostContext.close();
    await guestContext.close();
  });
});
