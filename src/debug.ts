import { BaseConfig } from 'bases/baseConfig';
import { BaseBuilder } from 'bases/baseConfigBuilder';
import { CardViewBuilder } from 'bases/cardViewBuilder';
import { FilterGroup } from 'bases/filter';
import { Formula } from 'bases/formula';
import { Property } from 'bases/property';
import * as yaml from 'js-yaml';
import ProgrammaticBases from 'main';

export function debugGame() {
  let viewBuilder = new CardViewBuilder();
  viewBuilder.setName('Game');
  viewBuilder.setFilter(new FilterGroup('and', [ 'file.hasProperty("year_rank")' ]));

  let baseBuilder = new BaseBuilder();
  baseBuilder.addView(viewBuilder);
  baseBuilder.addFormula(new Formula("Rank Title", "file.properties[\"rank\"] + \" \" + file.properties[\"name\"]"))
  
  let base = baseBuilder.build();
  let yaml = base.serialize();
  return yaml;
}

export function debugTask() {
  let viewBuilder = new CardViewBuilder();
  viewBuilder.setName('Task');
  viewBuilder.setFilter(new FilterGroup('and', [ 'file.hasProperty("status")' ]));

  let baseBuilder = new BaseBuilder();
  baseBuilder.addView(viewBuilder);
  baseBuilder.addFormula(new Formula("Color", 'if(file.properties["Priority"] == 1, "#c00000", if(file.properties["Priority"] == 2, "#c8c800", "#00c000"))'));
  
  let base = baseBuilder.build();
  let yaml = base.serialize();
  return yaml;
}

function printSuccess() {
  console.log("success!!");
}

function printFailure() {
  console.log("failure :(");
}

export async function promiseTesting(succeed: boolean) {
  const myPromise = new Promise<void>((resolve, reject) => {
    console.log(`input value: ${succeed}`);
    if (succeed) {
      resolve();
    } else {
      reject(new Error("didnt do it"));
    }
  });

  myPromise.then(printSuccess, printFailure);
}

export async function testJsYaml() {
  const formula: Record<string, string> = {
    "resolved": "status == true"
  }
  
  const view: Record<string, any> = {
    name: "all tasks",
    groupBy: {
      property: "file.path",
      direction: "ASC"
    },
    formulas: [
      formula
    ]
  }

  const base: Record<string, string> = {
    filter: "nothing!!!"
  }

  const v: any = {
    views: [
      view
    ],
    
  }
  

  console.log(v)
  //console.log(Object.entries(v))

  console.log(yaml.dump(v, { lineWidth: -1 }));
  //console.log(yaml.dump(Object.entries(v), { lineWidth: -1 }));

  console.log(yaml.load(yaml.dump(v, { lineWidth: -1 })));
  //console.log(yaml.load(yaml.dump(Object.entries(v), { lineWidth: -1 })));
}

export async function testJsYamlLoad() {
  
  const path = "Bases\\testBase.base";
  const yamlString = await ProgrammaticBases.instance.app.vault.adapter.read(path);
  const yamlObj1 = yaml.load(yamlString);
  const baseConfig = BaseConfig.deserialize(yamlObj1 as Record<string, unknown>);
  const yamlObj2 = baseConfig.serialize();

  const yamlStringTr = yaml.dump(yamlObj2, { lineWidth: -1 });
    
  console.log(yamlString)
  console.log(baseConfig);
  console.log(yamlStringTr);
}