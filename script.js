const copyButton = document.querySelector("#copy-citation");
const citation = document.querySelector("#bibtex");
const status = document.querySelector("#copy-status");

if (copyButton && citation && navigator.clipboard?.writeText) {
  copyButton.hidden = false;
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(citation.textContent.trim());
      status.textContent = "BibTeX copied to clipboard.";
      copyButton.firstChild.textContent = "Copied ";
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(citation);
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = "Citation selected. Use your browser’s Copy command.";
    }
  });
}


// These examples illustrate operator semantics; they do not run models or predict scores.
const operatorInfo = {
  star: ["Star", "Workers solve independently. A single aggregator sees their outputs and synthesizes the final answer. Workers do not see each other’s proposals."],
  memory: ["SharedMemory", "Workers take turns reading and appending to one persistent document. Later workers inherit the accumulated state; an aggregator synthesizes the final document."],
  debate: ["Debate", "Workers propose answers in parallel. In later rounds, each worker sees all proposals from the preceding round and revises. A final aggregator combines them."],
  coordinator: ["StarWithCoordinator", "Workers answer in parallel, then a coordinator reads their outputs. Its directive reaches the next round of workers; the last coordinator call produces the answer."],
  moderator: ["DebateWithModerator", "Workers exchange all proposals between rounds. A moderator also reads each round and supplies guidance for the next; its final call produces the answer."],
  sequential: ["Sequential", "One agent follows two prompt steps: draft, then review. Each call receives the previous output, and the two-step chain repeats for the selected number of rounds."]
};
const explorer = document.querySelector("#operator-explorer");
if (explorer) {
  const graph = document.querySelector("#workflow-graph");
  const agents = document.querySelector("#agent-count");
  const rounds = document.querySelector("#round-count");
  const stepButton = document.querySelector("#step-workflow");
  let operator = "star", step = -1;
  let stages = [], nodes = [], edges = [];
  const svgNS = "http://www.w3.org/2000/svg";
  function el(tag, attrs = {}, content = "") {
    const element = document.createElementNS(svgNS, tag);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
    if (content) element.textContent = content;
    return element;
  }
  function build() {
    const n = operator === "sequential" ? 1 : Number(agents.value);
    const r = operator === "star" ? 1 : Number(rounds.value);
    agents.disabled = operator === "sequential";
    rounds.disabled = operator === "star";
    document.querySelector("#agent-value").textContent = n;
    document.querySelector("#round-value").textContent = r;
    document.querySelector("#round-note").textContent = operator === "star"
      ? "Star uses one round of independent answers."
      : operator === "sequential" ? "Two prompt steps per round, using one agent."
      : "A round is one complete pass of this communication pattern.";
    const groups = [];
    stages = []; nodes = []; edges = []; step = -1;
    function group(kind, labels, round) {
      const g = labels.map((label, i) => ({ id: "n" + nodes.length + "-" + i, label, kind, round }));
      nodes.push(...g); groups.push(g); return g;
    }
    const connect = (from, to) => from.forEach(a => to.forEach(b => edges.push([a.id, b.id])));
    let previous = [], lastWorkers = [];
    for (let round = 1; round <= r; round++) {
      if (operator === "sequential") {
        for (const label of ["Draft", "Review"]) {
          const g = group("worker", [label], round);
          connect(previous, g); previous = g;
          stages.push({ ids: g.map(a => a.id), text: "Round " + round + ": " + label.toLowerCase() + " using the original task and previous output." });
        }
        continue;
      }
      const workers = group("worker", Array.from({length:n}, (_,i) => "W" + (i+1)), round);
      if (operator === "memory") {
        connect(previous, [workers[0]]);
        for (let i=0; i<n; i++) {
          if (i) connect([workers[i-1]], [workers[i]]);
          stages.push({ids:[workers[i].id], text:"Round " + round + ": worker " + (i+1) + " reads the shared document, then appends its contribution."});
        }
        previous = [workers[n-1]];
      } else {
        connect(previous, workers);
        if (operator === "moderator" && lastWorkers.length) connect(lastWorkers, workers);
        stages.push({ids:workers.map(a => a.id), text:"Round " + round + ": " + n + " workers answer in parallel" + (round === 1 ? " from the original task." : operator === "coordinator" ? " using the coordinator’s directive." : operator === "moderator" ? " using peer proposals and moderator guidance." : " using all proposals from the previous round.")});
        previous = workers;
      }
      lastWorkers = workers;
      if (operator === "coordinator" || operator === "moderator") {
        const hub = group("hub", [operator === "coordinator" ? "C" : "M"], round);
        connect(workers, hub); previous = hub;
        stages.push({ids:hub.map(a => a.id), text:"Round " + round + ": the " + (operator === "coordinator" ? "coordinator" : "moderator") + (round === r ? " synthesizes the final answer." : " reads the workers’ outputs and prepares guidance.")});
      }
    }
    if (["star","memory","debate"].includes(operator)) {
      const hub = group("hub", ["A"], r);
      connect(previous, hub);
      stages.push({ids:hub.map(a => a.id), text:"The aggregator synthesizes " + (operator === "memory" ? "the accumulated shared document" : "the workers’ final proposals") + " into an answer."});
    }
    groups.forEach((g, i) => g.forEach((node,j) => {
      node.x = 65 + i * (490 / Math.max(1,groups.length-1));
      node.y = g.length === 1 ? 146 : 65 + j * (150 / (g.length-1));
    }));
    document.querySelector("#call-count").textContent = nodes.length;
    document.querySelector("#stage-count").textContent = stages.length;
    document.querySelector("#operator-name").textContent = operatorInfo[operator][0];
    document.querySelector("#operator-detail").textContent = operatorInfo[operator][1];
    draw();
  }
  function draw() {
    graph.replaceChildren();
    graph.append(el("title", {id:"graph-title"}, operatorInfo[operator][0] + " workflow"));
    graph.append(el("desc", {id:"graph-description"}, operatorInfo[operator][1]));
    const defs = el("defs");
    const marker = el("marker", {id:"arrow", viewBox:"0 0 10 10", refX:9, refY:5, markerWidth:5, markerHeight:5, orient:"auto-start-reverse"});
    marker.append(el("path", {d:"M 0 0 L 10 5 L 0 10 z", fill:"#9baeb8"})); defs.append(marker); graph.append(defs);
    const active = new Set(step < 0 ? [] : stages[step].ids);
    const map = new Map(nodes.map(n=>[n.id,n]));
    for (const [from,to] of edges) {
      const a = map.get(from), b = map.get(to);
      const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
      graph.append(el("line", {x1:a.x+dx/len*21,y1:a.y+dy/len*21,x2:b.x-dx/len*24,y2:b.y-dy/len*24,
        stroke:active.has(to)?"#a44b34":"#bdcbd1","stroke-width":active.has(to)?1.8:1,
        "marker-end":"url(#arrow)",opacity:operator==="moderator"?.65:1}));
    }
    const labels = new Set();
    for (const n of nodes) {
      const labelKey = n.x + "-" + n.round;
      if (!labels.has(labelKey)) {
        graph.append(el("text", {x:n.x,y:28,"text-anchor":"middle",class:"graph-round"}, "R" + n.round));
        labels.add(labelKey);
      }
      const g = el("g", {class:active.has(n.id)?"graph-node is-active":"graph-node"});
      const fill = n.kind==="hub"?"#f0ebf4":"#edf2f5";
      const stroke = active.has(n.id)?"#a44b34":n.kind==="hub"?"#8a749b":"#66889b";
      if (n.kind==="hub") g.append(el("rect",{x:n.x-21,y:n.y-21,width:42,height:42,rx:7,fill,stroke,"stroke-width":active.has(n.id)?2.6:1.4}));
      else g.append(el("circle",{cx:n.x,cy:n.y,r:21,fill,stroke,"stroke-width":active.has(n.id)?2.6:1.4}));
      g.append(el("text",{x:n.x,y:n.y+4,"text-anchor":"middle",class:"graph-node-label"},n.label));
      graph.append(g);
    }
    graph.append(el("text",{x:310,y:265,"text-anchor":"middle",class:"graph-caption"},
      operator==="memory"?"Every worker reads and updates the same persistent document."
      : operator==="sequential"?"Each step receives the preceding output."
      :"A = aggregator · C = coordinator · M = moderator"));
    document.querySelector("#step-status").textContent = step < 0 ? "Ready. Step through the workflow." : "Stage " + (step+1) + "/" + stages.length + " — " + stages[step].text;
    stepButton.firstChild.textContent = step === stages.length-1 ? "Replay example " : "Next stage ";
  }
  explorer.querySelectorAll("[data-operator]").forEach(button=>button.addEventListener("click",()=>{
    operator=button.dataset.operator;
    explorer.querySelectorAll("[data-operator]").forEach(b=>b.setAttribute("aria-pressed",String(b===button)));
    if(operator!=="star" && Number(rounds.value)===1) rounds.value="2";
    build();
  }));
  agents.addEventListener("input",build); rounds.addEventListener("input",build);
  stepButton.addEventListener("click",()=>{step=(step+1)%stages.length;draw();});
  document.querySelector("#reset-workflow").addEventListener("click",()=>{step=-1;draw();});
  build();
}
const problem = document.querySelector("#example-problem");
if (problem) {
  const includeProblem = document.querySelector("#route-problem");
  const includeDraft = document.querySelector("#route-draft");
  function routePrompt() {
    const lines=["Review the candidate solution. Check the constraints and correct any errors."];
    if(includeProblem.checked) lines.push("Original problem:\n"+(problem.value.trim()||"[No problem text supplied]"));
    if(includeDraft.checked) lines.push("Previous output:\n[Illustrative placeholder for the Star aggregator’s draft solution]");
    document.querySelector("#routed-prompt").textContent=lines.join("\n\n");
    document.querySelector("#routing-status").textContent=includeProblem.checked&&includeDraft.checked
      ? "Both the original task and the draft reach the validator."
      : !includeProblem.checked&&!includeDraft.checked ? "The validator receives neither the task nor the draft."
      : !includeProblem.checked ? "The original task is missing from this template." : "The draft is missing, so there is no candidate solution to review.";
  }
  [problem,includeProblem,includeDraft].forEach(input=>input.addEventListener("input",routePrompt));
  routePrompt();
}
