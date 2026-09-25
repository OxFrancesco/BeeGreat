import type { JsonInput } from "../src/json-contract";
import { expect, test } from "bun:test";
import { polymarketModelOutput, projectPolymarket, polymarketOutputBytes } from "../src/integrations/polymarket/model-output";
import type { PolymarketRead } from "../src/integrations/polymarket/client";

const market = (id: number) => ({id:String(id),slug:`market-${id}`,question:`Will BTC reach $100k by December 31, ${2026+id}?`,endDate:`${2027+id}-01-01`,outcomes:'["Yes","No"]',outcomePrices:'["0.37","0.63"]',clobTokenIds:JSON.stringify([`yes-${id}`,`no-${id}`]),description:"長".repeat(100_000)});
const read = (data: JsonInput): PolymarketRead => ({endpoint:"search",source:"https://gamma-api.polymarket.com/public-search?q=BTC",observedAt:"2026-09-24T07:13:40Z",data,next:{endpoint:"search",input:{q:"BTC",page:2}}});

test("discovery retains exact market pairs and paging without repeated descriptions", () => {
  const result=read({events:[{id:"event",slug:"btc",title:"Bitcoin",markets:[market(0),market(1)]}]});
  const projected=projectPolymarket(result);
  const json=polymarketModelOutput(result,projected.data);
  expect(Buffer.byteLength(json)).toBeLessThan(3000);
  expect(json).not.toContain("長");
  const parsed=JSON.parse(json);
  expect(parsed).toMatchObject({next:result.next,presentation:{partial:false}});
  expect(parsed.data.events[0].markets[0].outcomes).toEqual([{label:"Yes",price:0.37,token_id:"yes-0"},{label:"No",price:0.63,token_id:"no-0"}]);
  expect(projected.tokens.find(t=>t.tokenId==="yes-0")).toMatchObject({title:market(0).question,outcome:"Yes",url:"https://polymarket.com/event/btc"});
});

test("nested markets have a byte budget and explicit omissions separate from upstream paging", () => {
  const result=read({events:[{id:"event",slug:"btc",title:"Bitcoin",markets:Array.from({length:300},(_,i)=>({...market(i),description:"unused"}))}]});
  const json=polymarketModelOutput(result);
  expect(Buffer.byteLength(json)).toBeLessThan(polymarketOutputBytes);
  expect(json).toContain("yes-0");
  const parsed=JSON.parse(json);
  expect(parsed.presentation.partial).toBe(true);
  expect(parsed.presentation.omitted_paths.length).toBeGreaterThan(0);
  expect(parsed.next).toEqual(result.next);
  expect(parsed.presentation.recovery).toContain("focused read");
  expect(json).not.toContain("saved to");
});

test("oversized non-discovery data and resolution rules stay bounded and explicitly partial", () => {
  const result={...read(market(0)),endpoint:"market_by_slug"};
  const json=polymarketModelOutput(result);
  expect(Buffer.byteLength(json)).toBeLessThan(polymarketOutputBytes);
  expect(JSON.parse(json)).toMatchObject({presentation:{partial:true},data:{id:"0"}});
  expect(JSON.parse(json).data.outcomes[0].token_id).toBe("yes-0");
  const raw={...read({data:Array.from({length:1000},()=>({title:"長".repeat(500),current_price:0.5}))}),endpoint:"positions"};
  expect(Buffer.byteLength(polymarketModelOutput(raw))).toBeLessThan(polymarketOutputBytes);
});

test("missing or malformed optional upstream fields never restore bulky raw discovery", () => {
  const sparse = {...market(0),outcomePrices:undefined,volume24hr:"unknown",events:null};
  const result=read({events:[{id:"event",slug:"btc",markets:[sparse]}]});
  const json=polymarketModelOutput(result);
  expect(Buffer.byteLength(json)).toBeLessThan(2000);
  expect(json).not.toContain("長");
  expect(JSON.parse(json).data.events[0].markets[0].outcomes[0]).toEqual({label:"Yes",price:null,token_id:"yes-0"});
});

test("active search excludes closed children and a large event cannot hide later event identifiers", () => {
  const result=read({events:[{id:"large",slug:"large",title:"Many markets",markets:Array.from({length:300},(_,i)=>market(i))},{id:"later",slug:"later",title:"Other deadline",markets:[market(101)]}]});
  const output=JSON.parse(polymarketModelOutput(result));
  expect(output.presentation.partial).toBe(true);
  expect(output.data.events[1]).toMatchObject({id:"later",slug:"later",title:"Other deadline"});
  expect(output.data.events[1].markets[0].outcomes[0].token_id).toBe("yes-101");
  const mixed=read({events:[{id:"event",markets:[{...market(0),closed:true},{...market(1),closed:false}]}]});
  const active=polymarketModelOutput(mixed,projectPolymarket(mixed,{events_status:"active"}).data);
  expect(JSON.parse(active).data.events[0]).toMatchObject({filtered_closed_markets:1,markets:[{id:"1"}]});
  expect(JSON.parse(polymarketModelOutput(mixed)).data.events[0].markets).toHaveLength(2);
});
