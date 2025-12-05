import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('Pedigree MCP Server Integration', () => {
    let client: Client;
    let transport: StdioClientTransport;
    let serverProcess: ChildProcess;

    beforeAll(async () => {
        const serverPath = path.resolve(__dirname, '../src/index.ts');

        // Spawn the MCP server
        serverProcess = spawn('npx', ['tsx', serverPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: path.resolve(__dirname, '..'),
        });

        // Create transport using the spawned process
        transport = new StdioClientTransport({
            command: 'npx',
            args: ['tsx', serverPath],
            cwd: path.resolve(__dirname, '..'),
        });

        // Create and connect client
        client = new Client({
            name: 'test-client',
            version: '1.0.0',
        });

        await client.connect(transport);
    }, 30000);

    afterAll(async () => {
        await client?.close();
        serverProcess?.kill();
    });

    describe('tool discovery', () => {
        it('should list available tools', async () => {
            const tools = await client.listTools();

            expect(tools.tools).toBeDefined();
            expect(tools.tools.length).toBe(2);

            const toolNames = tools.tools.map(t => t.name);
            expect(toolNames).toContain('get_pedigree_documentation');
            expect(toolNames).toContain('generate_pedigree');
        });

        it('should have correct schema for get_pedigree_documentation', async () => {
            const tools = await client.listTools();
            const docTool = tools.tools.find(
                t => t.name === 'get_pedigree_documentation',
            );

            expect(docTool).toBeDefined();
            expect(docTool?.description).toContain('documentation');
        });

        it('should have correct schema for generate_pedigree', async () => {
            const tools = await client.listTools();
            const genTool = tools.tools.find(
                t => t.name === 'generate_pedigree',
            );

            expect(genTool).toBeDefined();
            expect(genTool?.description).toContain('PNG');
            expect(genTool?.inputSchema).toBeDefined();
        });
    });

    describe('get_pedigree_documentation tool', () => {
        it('should return comprehensive documentation', async () => {
            const result = await client.callTool({
                name: 'get_pedigree_documentation',
                arguments: {},
            });

            expect(result.content).toBeDefined();
            expect(result.content.length).toBeGreaterThan(0);

            const textContent = result.content.find(
                (c: any) => c.type === 'text',
            );
            expect(textContent).toBeDefined();

            const text = textContent?.text as string;
            expect(text).toContain('Individual Properties');
            expect(text).toContain('name');
            expect(text).toContain('sex');
            expect(text).toContain('mother');
            expect(text).toContain('father');
            expect(text).toContain('proband');
            expect(text).toContain('conditions');
            expect(text).toContain('Bennett');
        });
    });

    describe('generate_pedigree tool', () => {
        it('should generate PNG for simple pedigree', async () => {
            const result = await client.callTool({
                name: 'generate_pedigree',
                arguments: {
                    dataset: [
                        { name: 'gf', sex: 'M', top_level: true },
                        { name: 'gm', sex: 'F', top_level: true },
                        {
                            name: 'p',
                            sex: 'F',
                            mother: 'gm',
                            father: 'gf',
                            proband: true,
                        },
                    ],
                },
            });

            expect(result.content).toBeDefined();
            expect(result.content.length).toBeGreaterThan(0);

            // Should have text content with metadata
            const textContent = result.content.find(
                (c: any) => c.type === 'text',
            );
            expect(textContent).toBeDefined();
            expect(textContent?.text).toContain('successfully');

            // Should have image content with base64 PNG
            const imageContent = result.content.find(
                (c: any) => c.type === 'image',
            );
            expect(imageContent).toBeDefined();
            expect(imageContent?.mimeType).toBe('image/png');
            expect(imageContent?.data).toBeDefined();

            // Verify it's valid base64 that decodes to PNG
            const buffer = Buffer.from(imageContent?.data as string, 'base64');
            expect(buffer[0]).toBe(0x89); // PNG magic byte
            expect(buffer[1]).toBe(0x50); // P
            expect(buffer[2]).toBe(0x4e); // N
            expect(buffer[3]).toBe(0x47); // G
        }, 30000);

        it('should generate PNG with condition markers', async () => {
            const result = await client.callTool({
                name: 'generate_pedigree',
                arguments: {
                    dataset: [
                        { name: 'gf', sex: 'M', top_level: true },
                        {
                            name: 'gm',
                            sex: 'F',
                            top_level: true,
                            conditions: [{ name: 'Breast cancer', age: 55 }],
                        },
                        {
                            name: 'mom',
                            sex: 'F',
                            mother: 'gm',
                            father: 'gf',
                            conditions: [{ name: 'Breast cancer', age: 42 }],
                        },
                        { name: 'dad', sex: 'M', top_level: true },
                        {
                            name: 'p',
                            sex: 'F',
                            mother: 'mom',
                            father: 'dad',
                            proband: true,
                            age: 25,
                        },
                    ],
                },
            });

            expect(result.content).toBeDefined();

            const imageContent = result.content.find(
                (c: any) => c.type === 'image',
            );
            expect(imageContent).toBeDefined();
            expect(imageContent?.mimeType).toBe('image/png');
        }, 30000);

        it('should respect custom dimensions', async () => {
            const result = await client.callTool({
                name: 'generate_pedigree',
                arguments: {
                    dataset: [
                        { name: 'f', sex: 'M', top_level: true },
                        { name: 'm', sex: 'F', top_level: true },
                    ],
                    width: 1200,
                    height: 800,
                },
            });

            expect(result.content).toBeDefined();

            const textContent = result.content.find(
                (c: any) => c.type === 'text',
            );
            expect(textContent?.text).toContain('1200x800');
        }, 30000);

        it('should return error for invalid dataset', async () => {
            const result = await client.callTool({
                name: 'generate_pedigree',
                arguments: {
                    dataset: [
                        {
                            name: 'child',
                            sex: 'F',
                            mother: 'missing_mom',
                            father: 'dad',
                        },
                        { name: 'dad', sex: 'M', top_level: true },
                    ],
                },
            });

            expect(result.isError).toBe(true);

            const textContent = result.content.find(
                (c: any) => c.type === 'text',
            );
            expect(textContent?.text).toContain('error');
        });

        it('should generate PNG with condition legend', async () => {
            const result = await client.callTool({
                name: 'generate_pedigree',
                arguments: {
                    dataset: [
                        {
                            name: 'gf',
                            sex: 'M',
                            top_level: true,
                            conditions: [{ name: 'Huntington disease' }],
                        },
                        {
                            name: 'gm',
                            sex: 'F',
                            top_level: true,
                            conditions: [{ name: 'Breast cancer', age: 55 }],
                        },
                        {
                            name: 'p',
                            sex: 'F',
                            mother: 'gm',
                            father: 'gf',
                            proband: true,
                            conditions: [
                                { name: 'Huntington disease' },
                                { name: 'Breast cancer', age: 42 },
                            ],
                        },
                    ],
                },
            });

            expect(result.content).toBeDefined();

            const imageContent = result.content.find(
                (c: any) => c.type === 'image',
            );
            expect(imageContent).toBeDefined();
            expect(imageContent?.mimeType).toBe('image/png');

            // Legend should be included (larger image due to legend space)
            const buffer = Buffer.from(imageContent?.data as string, 'base64');
            expect(buffer.length).toBeGreaterThan(5000);
        }, 30000);

        it('should handle complex multi-generation pedigree', async () => {
            const result = await client.callTool({
                name: 'generate_pedigree',
                arguments: {
                    dataset: [
                        { name: 'ggf', sex: 'M', top_level: true, status: 1 },
                        {
                            name: 'ggm',
                            sex: 'F',
                            top_level: true,
                            status: 1,
                            conditions: [{ name: 'Ovarian cancer', age: 72 }],
                        },
                        {
                            name: 'gf1',
                            sex: 'M',
                            mother: 'ggm',
                            father: 'ggf',
                            status: 1,
                        },
                        {
                            name: 'gm1',
                            sex: 'F',
                            top_level: true,
                            conditions: [{ name: 'Breast cancer', age: 58 }],
                        },
                        {
                            name: 'f1',
                            sex: 'M',
                            mother: 'gm1',
                            father: 'gf1',
                            age: 52,
                        },
                        {
                            name: 'm1',
                            sex: 'F',
                            mother: 'gm1',
                            father: 'gf1',
                            age: 48,
                            conditions: [{ name: 'Breast cancer', age: 44 }],
                        },
                        { name: 'sp1', sex: 'F', top_level: true, age: 50 },
                        {
                            name: 'ch1',
                            display_name: 'Patient',
                            sex: 'F',
                            mother: 'm1',
                            father: 'f1',
                            proband: true,
                            age: 25,
                        },
                        {
                            name: 'ch2',
                            sex: 'M',
                            mother: 'm1',
                            father: 'f1',
                            age: 22,
                        },
                    ],
                },
            });

            expect(result.content).toBeDefined();

            const textContent = result.content.find(
                (c: any) => c.type === 'text',
            );
            expect(textContent?.text).toContain('Individuals: 9');

            const imageContent = result.content.find(
                (c: any) => c.type === 'image',
            );
            expect(imageContent).toBeDefined();
        }, 30000);
    });

    describe('full workflow', () => {
        it('should support doc-first workflow: read docs then generate', async () => {
            // Step 1: Get documentation
            const docsResult = await client.callTool({
                name: 'get_pedigree_documentation',
                arguments: {},
            });

            expect(docsResult.content).toBeDefined();
            const docsText = docsResult.content.find(
                (c: any) => c.type === 'text',
            )?.text;
            expect(docsText).toContain('Example');

            // Step 2: Generate pedigree based on documentation
            const genResult = await client.callTool({
                name: 'generate_pedigree',
                arguments: {
                    dataset: [
                        { name: 'm11', sex: 'M', top_level: true },
                        {
                            name: 'f11',
                            display_name: 'Jane',
                            sex: 'F',
                            status: 1,
                            top_level: true,
                            conditions: [{ name: 'Breast cancer', age: 67 }],
                        },
                        {
                            name: 'ch1',
                            display_name: 'Ana',
                            sex: 'F',
                            mother: 'f11',
                            father: 'm11',
                            proband: true,
                            age: 25,
                        },
                    ],
                },
            });

            expect(genResult.content).toBeDefined();
            const imageContent = genResult.content.find(
                (c: any) => c.type === 'image',
            );
            expect(imageContent).toBeDefined();
            expect(imageContent?.mimeType).toBe('image/png');
        }, 60000);
    });
});
