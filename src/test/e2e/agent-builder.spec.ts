import { test, expect } from '@playwright/test';

test.describe('Agent Builder', () => {
  test.skip('should create a new agent', async ({ page }) => {
    await page.goto('/agents/new');

    // Fill in the agent name
    await page.getByLabel('Agent Name').fill('Test Support Agent');

    // Select an LLM model
    await page.getByLabel('Model').click();
    await page.getByRole('option', { name: /gpt-4/i }).click();

    // Fill in the system prompt
    await page.getByLabel('System Prompt').fill('You are a helpful customer support agent.');

    // Save the agent
    await page.getByRole('button', { name: /save|create/i }).click();

    // Verify redirect to the agent builder canvas
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/builder/);
    await expect(page.getByText('Test Support Agent')).toBeVisible();
  });

  test.skip('should save agent configuration', async ({ page }) => {
    await page.goto('/agents');

    // Open an existing agent
    await page.getByText('Test Support Agent').click();
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+/);

    // Modify the temperature setting
    const temperatureSlider = page.getByLabel('Temperature');
    await temperatureSlider.fill('0.7');

    // Auto-save should trigger
    await page.waitForTimeout(2000);

    // Verify the saved indicator appears
    await expect(page.getByText(/saved|auto-saved/i)).toBeVisible();
  });

  test.skip('should add tools to an agent', async ({ page }) => {
    await page.goto('/agents');
    await page.getByText('Test Support Agent').click();

    // Navigate to tools tab
    await page.getByRole('tab', { name: /tools/i }).click();

    // Add a new tool
    await page.getByRole('button', { name: /add tool/i }).click();
    await page.getByText('Web Search').click();

    // Verify the tool appears in the agent's tool list
    await expect(page.getByText('Web Search')).toBeVisible();
  });

  test.skip('should configure knowledge base for an agent', async ({ page }) => {
    await page.goto('/agents');
    await page.getByText('Test Support Agent').click();

    // Navigate to knowledge tab
    await page.getByRole('tab', { name: /knowledge/i }).click();

    // Upload a document
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'faq.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Q: What is the return policy?\nA: 30 days from purchase.'),
    });

    // Verify the document appears in the knowledge list
    await expect(page.getByText('faq.txt')).toBeVisible();
  });

  test.skip('should deploy an agent', async ({ page }) => {
    await page.goto('/agents');
    await page.getByText('Test Support Agent').click();

    // Click the deploy button
    await page.getByRole('button', { name: /deploy/i }).click();

    // Confirm deployment dialog
    await page.getByRole('button', { name: /confirm/i }).click();

    // Verify deployment status
    await expect(page.getByText(/deployed|active/i)).toBeVisible({ timeout: 10000 });
  });

  test.skip('should test agent in playground', async ({ page }) => {
    await page.goto('/agents');
    await page.getByText('Test Support Agent').click();

    // Open the playground / test panel
    await page.getByRole('button', { name: /test|playground/i }).click();

    // Type a message
    await page.getByPlaceholder(/type a message/i).fill('What is the return policy?');
    await page.getByRole('button', { name: /send/i }).click();

    // Wait for agent response
    const response = page.locator('[data-testid="agent-response"]').last();
    await expect(response).toBeVisible({ timeout: 15000 });
    await expect(response).not.toBeEmpty();
  });

  test.skip('should duplicate an existing agent', async ({ page }) => {
    await page.goto('/agents');

    // Open context menu or actions for an agent
    await page.getByText('Test Support Agent').hover();
    await page.getByRole('button', { name: /more|actions/i }).click();
    await page.getByRole('menuitem', { name: /duplicate|clone/i }).click();

    // Verify the duplicated agent appears
    await expect(page.getByText('Test Support Agent (Copy)')).toBeVisible();
  });

  test.skip('should delete an agent with confirmation', async ({ page }) => {
    await page.goto('/agents');

    // Open actions for the duplicated agent
    await page.getByText('Test Support Agent (Copy)').hover();
    await page.getByRole('button', { name: /more|actions/i }).click();
    await page.getByRole('menuitem', { name: /delete/i }).click();

    // Confirm deletion in the dialog
    await page.getByRole('button', { name: /confirm|delete/i }).click();

    // Verify the agent is removed from the list
    await expect(page.getByText('Test Support Agent (Copy)')).not.toBeVisible();
  });

  test.skip('should navigate workflow canvas with drag and drop', async ({ page }) => {
    await page.goto('/agents');
    await page.getByText('Test Support Agent').click();

    // Navigate to workflow tab
    await page.getByRole('tab', { name: /workflow/i }).click();

    // Verify the canvas is visible
    const canvas = page.locator('[data-testid="workflow-canvas"]');
    await expect(canvas).toBeVisible();

    // Add a node by dragging from the palette
    const nodeType = page.getByText('Condition');
    const canvasArea = page.locator('[data-testid="workflow-canvas"]');

    await nodeType.dragTo(canvasArea);

    // Verify a new node was added
    await expect(page.locator('[data-testid="workflow-node"]')).toHaveCount(2); // start node + new node
  });
});
