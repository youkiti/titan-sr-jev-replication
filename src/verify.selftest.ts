import assert from 'node:assert/strict';
import { benchConfig, loadConfig } from './common';
import { configHash, screeningPrompt } from './ledger';
import { buildTypeSafeScreeningRequest, parseTypeSafeScreeningResponse } from './typesafe';

// Hashes recorded in the original run, independent of the merged configuration.
const expected: Record<string, string> = {
    "CD011218": "1fbabe30a05425b10fc80e14233390387e263b82b11320d4259fb710c4f099aa",
    "CD012268": "986aad59ffc111219377e674d5fe7d20b3c9bf59e9cc1a710c6088e6ac140390",
    "CD013042": "d422ad195884127924b2d69cef12243481726f5d88782b7867b91776b097a532",
    "CD013059": "d098dd6bc6c7f7fd198ce9c09366687898c52cdda2d3a6d7ca3f9f97d1d66256",
    "CD013071": "87cc33325c4d7c9bffd33737cbad8391b848c91d5483c7877ac7a654721875cc",
    "CD013197": "2225851d0eb477475f6163de7a15f7af345f19ee5a7a4e87f2259f714e1e04fd",
    "CD013199": "1559740fe76ad1afba80b5e5b2f5d08b5c5a336ef2f533c98fa022d663fd3c44",
    "CD013295": "77b74a4a60323fdfd69fbc64c878ae7623fabc8fde383f009f374f2f77d4bf88",
    "CD013358": "368debcdc3132fca82fd981b7d37108a592634ebd727ffd37852482848ea1911",
    "CD013377": "4864113aab53cfd85fc4b83fe8f78dfa181a3c1a6eb428abcef6a4e9a1314e1c",
    "CD013421": "5e1eb9d36064bf8996febe42e0f8762b2e643e5e29cfa6ca6c59eee0a50473d7",
    "CD013590": "4b62686f980c14ad5d1368a3360fe1e224a690ab566e939f1858a0390b02d863",
    "CD013591": "0a5d6df513f2f181507900923344440a30c14e1301341be372965976428923bf",
    "CD013822": "8cb8fa9de0992eda3db678ff70717c347303be332eafc039b01c62967b8db125",
    "CD013880": "346a34a917b76ea15a85dc71d988deb6bf8172dfaa76ac2dcb5e94efe22a56d2",
    "CD014715": "86cb0b5328c537686a5ae0e63e8169f348b43be7cd3ed0afda4272ba05414c1e",
    "CD014736": "7f647aa9cfa34b2de9250587b2024dec9d65e37ec59b7554d400fc781d2430ef",
    "CD015038": "0f85e5f898a3f20b8851be6374b7f162941b75dfc3e10dd1a291b1e5e43747bb",
    "CD015042": "ad8f8c0d9cb444312b5629cde33774a6530ba0f0dc91fd56cd773cf62db46edf",
    "CD015067": "0237ef44542154f812d09a3be83780d643f56d1b751c72924c7f940dc250f1f4",
    "CD015306": "418417cfaee02ec2fb4098776596474143005b5d41dfdf01be6e0a9df037b06f",
    "CD015432": "764992fcd18ffb79866d3eef4dc9b23abaa2e8a763f94cc7cceb50249c79244e"
};
const config = benchConfig(loadConfig());
assert.equal(Object.keys(expected).length, 22);
assert.deepEqual(Object.keys(config.datasets).sort(), Object.keys(expected).sort());
for (const [review, hash] of Object.entries(expected)) assert.equal(configHash(config, review), hash, review);
const params = { title: 'Example title', abstract: '', model: config.model,
    screeningPrompt: screeningPrompt(config, 'CD011218'), outputLanguage: config.outputLanguage };
assert.deepEqual(buildTypeSafeScreeningRequest(params).body, {
    model: 'jev-1.13.0',
    state: { title: 'Example title', abstract: '(no abstract)' },
    questions: { include: { type: 'noul', instructions: {
        screening_prompt: params.screeningPrompt,
        question: 'Based on `screening_prompt`, should this record be included at the title/abstract screening stage?',
    } } },
});
assert.equal(buildTypeSafeScreeningRequest({ ...params, abstract: 'Full abstract' }).body.state.abstract, 'Full abstract');
assert.equal(parseTypeSafeScreeningResponse({ answers: { include: { noul: 1.2 } } }, params).output.include_probability, 1);
assert.throws(() => parseTypeSafeScreeningResponse({ answers: { include: { noul: '0.3' } } }, params));
console.log('Configuration hashes and request body: OK');
