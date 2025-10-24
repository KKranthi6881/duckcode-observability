/**
 * Test script for Documentation Generation Service
 * Run with: npx ts-node -r tsconfig-paths/register src/services/documentation/test-documentation-service.ts
 */

import 'dotenv/config'; // Load .env file
import { DocumentationGenerationService } from './DocumentationGenerationService';

async function testDocumentationService() {
  console.log('🧪 Testing Documentation Generation Service\n');

  try {
    // Replace with your test organization ID
    const TEST_ORG_ID = process.env.TEST_ORG_ID || '';
    const TEST_OBJECT_ID = process.env.TEST_OBJECT_ID || '';

    if (!TEST_ORG_ID) {
      console.error('❌ Error: TEST_ORG_ID environment variable not set');
      console.log('   Set it to an organization ID that has an OpenAI API key configured');
      process.exit(1);
    }

    if (!TEST_OBJECT_ID) {
      console.error('❌ Error: TEST_OBJECT_ID environment variable not set');
      console.log('   Set it to a metadata object ID to generate documentation for');
      process.exit(1);
    }

    console.log(`📋 Test Configuration:`);
    console.log(`   Organization ID: ${TEST_ORG_ID}`);
    console.log(`   Object ID: ${TEST_OBJECT_ID}\n`);

    // Initialize service
    console.log('1️⃣  Initializing DocumentationGenerationService...');
    const service = new DocumentationGenerationService(TEST_ORG_ID);
    
    console.log('2️⃣  Fetching and decrypting OpenAI API key...');
    await service.initialize();
    console.log('✅ OpenAI client initialized\n');

    // Fetch object metadata
    console.log('3️⃣  Fetching object metadata...');
    const objectData = await service.fetchObjectMetadata(TEST_OBJECT_ID);
    console.log(`✅ Fetched metadata for: ${objectData.name}`);
    console.log(`   Type: ${objectData.object_type}`);
    console.log(`   Columns: ${objectData.columns?.length || 0}`);
    console.log(`   Dependencies: ${objectData.dependencies?.length || 0}\n`);

    // Generate documentation
    console.log('4️⃣  Generating documentation layers...');
    console.log('   This will call OpenAI API multiple times (6 layers)');
    console.log('   Estimated cost: ~$0.05 - $0.10\n');

    const startTime = Date.now();
    const documentation = await service.generateDocumentationForObject(TEST_OBJECT_ID);
    const duration = Date.now() - startTime;

    console.log(`✅ Documentation generated in ${(duration / 1000).toFixed(2)}s\n`);

    // Display results
    console.log('📊 GENERATED DOCUMENTATION:\n');
    console.log('═══════════════════════════════════════════════════════');
    
    console.log('\n📄 LAYER 1: Executive Summary');
    console.log('─────────────────────────────────────────────────────');
    console.log(documentation.executiveSummary);
    
    console.log('\n\n📖 LAYER 2: Business Narrative');
    console.log('─────────────────────────────────────────────────────');
    console.log('What It Does:');
    console.log(documentation.businessNarrative.whatItDoes);
    console.log('\nData Journey:');
    documentation.businessNarrative.dataJourney.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step}`);
    });
    console.log('\nBusiness Impact:');
    console.log(documentation.businessNarrative.businessImpact);
    
    console.log('\n\n🎴 LAYER 3: Transformation Cards');
    console.log('─────────────────────────────────────────────────────');
    if (documentation.transformationCards.length > 0) {
      documentation.transformationCards.forEach((card, i) => {
        console.log(`\nCard ${i + 1}: ${card.title}`);
        console.log(`  Input:  ${card.input}`);
        console.log(`  Logic:  ${card.logic}`);
        console.log(`  Output: ${card.output}`);
        console.log(`  Why:    ${card.whyItMatters}`);
      });
    } else {
      console.log('  (No transformation cards generated)');
    }
    
    console.log('\n\n💻 LAYER 4: Code Explanations');
    console.log('─────────────────────────────────────────────────────');
    if (documentation.codeExplanations.length > 0) {
      documentation.codeExplanations.forEach((exp, i) => {
        console.log(`\nExplanation ${i + 1}:`);
        console.log(`  Code: ${exp.codeBlock.substring(0, 100)}...`);
        console.log(`  Plain English: ${exp.plainEnglish}`);
        console.log(`  Business Context: ${exp.businessContext}`);
      });
    } else {
      console.log('  (No code explanations generated)');
    }
    
    console.log('\n\n📏 LAYER 5: Business Rules');
    console.log('─────────────────────────────────────────────────────');
    if (documentation.businessRules.length > 0) {
      documentation.businessRules.forEach((rule, i) => {
        console.log(`\nRule ${i + 1}: ${rule.rule}`);
        console.log(`  Code: ${rule.codeReference}`);
        console.log(`  Impact: ${rule.impact}`);
      });
    } else {
      console.log('  (No business rules extracted)');
    }
    
    console.log('\n\n🎯 LAYER 6: Impact Analysis');
    console.log('─────────────────────────────────────────────────────');
    console.log('Used By:');
    documentation.impactAnalysis.usedBy.forEach(user => {
      console.log(`  - ${user.team} (${user.frequency}): ${user.purpose}`);
    });
    console.log('\nQuestions Answered:');
    documentation.impactAnalysis.questionsAnswered.forEach(q => {
      console.log(`  - ${q}`);
    });
    console.log('\nDownstream Impact:');
    console.log(`  ${documentation.impactAnalysis.downstreamImpact}`);
    
    console.log('\n\n📊 COMPLEXITY SCORE');
    console.log('─────────────────────────────────────────────────────');
    console.log(`  Score: ${documentation.complexityScore} / 5`);
    const stars = '⭐'.repeat(documentation.complexityScore) + '☆'.repeat(5 - documentation.complexityScore);
    console.log(`  ${stars}`);
    
    console.log('\n═══════════════════════════════════════════════════════\n');

    // Store documentation
    console.log('5️⃣  Storing documentation in database...');
    const docId = await service.storeDocumentation(
      TEST_OBJECT_ID,
      documentation,
      0, // We don't have token count from test
      duration
    );
    console.log(`✅ Documentation stored with ID: ${docId}\n`);

    // Success summary
    console.log('🎉 TEST COMPLETED SUCCESSFULLY!\n');
    console.log('Summary:');
    console.log(`  - Executive Summary: ${documentation.executiveSummary.length} chars`);
    console.log(`  - Business Narrative: ✅`);
    console.log(`  - Transformation Cards: ${documentation.transformationCards.length} cards`);
    console.log(`  - Code Explanations: ${documentation.codeExplanations.length} explanations`);
    console.log(`  - Business Rules: ${documentation.businessRules.length} rules`);
    console.log(`  - Impact Analysis: ✅`);
    console.log(`  - Complexity Score: ${documentation.complexityScore}/5`);
    console.log(`  - Processing Time: ${(duration / 1000).toFixed(2)}s`);
    console.log(`  - Documentation ID: ${docId}\n`);

    console.log('✅ Phase 2 service is working correctly!');
    console.log('🚀 Ready to proceed to Phase 3: Job Queue & Orchestration\n');

  } catch (error: any) {
    console.error('\n❌ TEST FAILED:\n');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    // Provide helpful hints
    console.error('\n💡 Troubleshooting:');
    if (error.message.includes('API key')) {
      console.error('   - Ensure OpenAI API key is configured in admin panel');
      console.error('   - Verify the key is set as default and active');
      console.error('   - Check API_KEY_ENCRYPTION_SECRET is set in .env');
    } else if (error.message.includes('object metadata')) {
      console.error('   - Verify TEST_OBJECT_ID exists in metadata.objects table');
      console.error('   - Ensure metadata extraction has completed');
    } else if (error.message.includes('rate limit')) {
      console.error('   - OpenAI rate limit hit, wait a few seconds and retry');
    }
    
    process.exit(1);
  }
}

// Run the test
testDocumentationService();
