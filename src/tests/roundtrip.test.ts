import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { describe, it, expect } from 'vitest';
import { BaseConfig } from 'bases/baseConfig';
import { ViewRegistry } from 'views/viewRegistry';
import { CardViewInstaller } from 'views/cardViewInstaller';
import { ListViewInstaller } from 'views/listViewInstaller';
import { TableViewInstaller } from 'views/tableViewInstaller';

describe('BaseConfig round trip', () => {
  it('serialize(deserialize(yaml)) should equal original yaml object', () => {
    // Set up the view registry exactly as the plugin does
    const viewRegistry = new ViewRegistry();
    [
        new CardViewInstaller(),
        new ListViewInstaller(),
        new TableViewInstaller()
    ].forEach(i => i.install(viewRegistry));

    // Read from disk
    const filePath = path.resolve(__dirname, 'fixtures/exampleBase.yaml');
    const yamlString = fs.readFileSync(filePath, 'utf-8');
    const yamlObj1 = yaml.load(yamlString);

    // Round trip
    const baseConfig = BaseConfig.deserialize(
        yamlObj1 as Record<string, unknown>,
        viewRegistry
    );
    const yamlObj2 = baseConfig.serialize();

    // Assert
    expect(yamlObj2).toEqual(yamlObj1);
  });
});