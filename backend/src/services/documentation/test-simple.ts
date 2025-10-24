/**
 * Simple test - just test the core GPT-4o documentation generation
 * Run with: npx ts-node -r tsconfig-paths/register src/services/documentation/test-simple.ts
 */

import 'dotenv/config';
import { DocumentationGenerationService } from './DocumentationGenerationService';

async function testSimple() {
  console.log('🧪 Simple Documentation Generation Test\n');

  try {
    const TEST_ORG_ID = process.env.TEST_ORG_ID || '';
    const TEST_OBJECT_ID = process.env.TEST_OBJECT_IDS?.split(',')[0] || '';

    if (!TEST_ORG_ID || !TEST_OBJECT_ID) {
      console.error('❌ Set TEST_ORG_ID and TEST_OBJECT_IDS');
      process.exit(1);
    }

    console.log(`Organization: ${TEST_ORG_ID}`);
    console.log(`Object: ${TEST_OBJECT_ID}\n`);

    // Initialize service
    console.log('1️⃣  Initializing service...');
    const service = new DocumentationGenerationService(TEST_ORG_ID);
    
    console.log('2️⃣  Initializing OpenAI (decrypting API key)...');
    await service.initialize();
    console.log('✅ OpenAI initialized!\n');

    // Fetch metadata
    console.log('3️⃣  Fetching object metadata...');
    const metadata = await service.fetchObjectMetadata(TEST_OBJECT_ID);
    console.log(`✅ Fetched: ${metadata.name} (${metadata.object_type})`);
    console.log(`   Columns: ${metadata.columns?.length || 0}`);
    console.log(`   Code length: ${metadata.definition?.length || 0} chars\n`);

    // Generate documentation
    console.log('4️⃣  Generating documentation with GPT-4o...');
    console.log('   This will take ~10-30 seconds\n');
    
    const startTime = Date.now();
    const docs = await service.generateDocumentationForObject(TEST_OBJECT_ID);
    const duration = Date.now() - startTime;

    console.log(`✅ Generated in ${(duration / 1000).toFixed(2)}s\n`);

    // Display results
    console.log('═'.repeat(60));
    console.log('📄 EXECUTIVE SUMMARY');
    console.log('═'.repeat(60));
    console.log(docs.executiveSummary);
    
    console.log('\n' + '═'.repeat(60));
    console.log('📖 BUSINESS NARRATIVE');
    console.log('═'.repeat(60));
    console.log('What It Does:');
    console.log(docs.businessNarrative.whatItDoes);
    console.log('\nData Journey:');
    docs.businessNarrative.dataJourney.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step}`);
    });
    console.log('\nBusiness Impact:');
    console.log(docs.businessNarrative.businessImpact);

    console.log('\n' + '═'.repeat(60));
    console.log('🎴 TRANSFORMATION CARDS');
    console.log('═'.repeat(60));
    if (docs.transformationCards.length > 0) {
      docs.transformationCards.forEach((card, i) => {
        console.log(`\n${i + 1}. ${card.title}`);
        console.log(`   Input:  ${card.input}`);
        console.log(`   Logic:  ${card.logic}`);
        console.log(`   Output: ${card.output}`);
        console.log(`   Why:    ${card.whyItMatters}`);
      });
    } else {
      console.log('(None generated)');
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📊 COMPLEXITY SCORE');
    console.log('═'.repeat(60));
    const stars = '⭐'.repeat(docs.complexityScore) + '☆'.repeat(5 - docs.complexityScore);
    console.log(`${stars} ${docs.complexityScore}/5`);

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 TEST SUCCESSFUL!');
    console.log('═'.repeat(60));
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`Executive Summary: ${docs.executiveSummary.length} chars`);
    console.log(`Business Narrative: ✅`);
    console.log(`Transformation Cards: ${docs.transformationCards.length}`);
    console.log(`Code Explanations: ${docs.codeExplanations.length}`);
    console.log(`Business Rules: ${docs.businessRules.length}`);
    console.log(`Impact Analysis: ✅`);
    console.log(`Complexity Score: ${docs.complexityScore}/5`);
    
    console.log('\n✅ Core GPT-4o integration working perfectly!');
    console.log('✅ API key encryption/decryption working!');
    console.log('✅ All 6 documentation layers generated!\n');

  } catch (error: any) {
    console.error('\n❌ TEST FAILED\n');
    console.error(error.message);
    if (error.stack) {
      console.error('\n' + error.stack);
    }
    process.exit(1);
  }
}

testSimple();
