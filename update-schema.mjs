fetch('http://localhost:8000/sql', {
  method: 'POST',
  headers: {
    'Authorization': 'Basic ' + btoa('root:root'),
    'Accept': 'application/json',
    'surreal-ns': 'nucleus',
    'surreal-db': 'nucleus'
  },
  body: `REMOVE TABLE workflow_action;`
}).then(r=>r.json()).then(o=>console.dir(o, {depth:null}));
