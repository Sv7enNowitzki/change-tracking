const cds = require('@sap/cds')

const isChangeTracked = (entity) => (
  (entity['@changelog']
  || entity.elements && Object.values(entity.elements).some(e => e['@changelog'])) && entity.query?.SET?.op !== 'union'
)


// Unfold @changelog annotations in loaded model
cds.on('loaded', m => {

  // Get definitions from Dummy entity in our models
  const { 'sap.changelog.aspect': aspect } = m.definitions; if (!aspect) return // some other model
  const { '@UI.Facets': [facet], elements: { changes } } = aspect
  changes.on.pop() // remove ID -> filled in below

  for (let name in m.definitions) {
    const entity = m.definitions[name]
    if (isChangeTracked(entity)) {

      // Determine entity keys
      const keys = [], { elements: elms } = entity
      for (let e in elms) if (elms[e].key) keys.push(e)

      // Add association to ChangeView...
      const on = [...changes.on]; keys.forEach((k, i) => { i && on.push('||'); on.push({
        ref: k === 'up_' ? [k,'ID'] : [k] // REVISIT: up_ handling is a dirty hack for now
      })})
      const assoc = { ...changes, on }
      const query = entity.projection || entity.query?.SELECT
      if (query) {
        (query.columns ??= ['*']).push({ as: 'changes', cast: assoc })
      } else {
        entity.elements.changes = assoc
      }

      // Add UI.Facet for Change History List
      entity['@UI.Facets']?.push(facet)

      // for custom action
      if (entity.actions) {
        // The update of the change history list of the entity needs to be triggered
        for (const se of Object.values(entity.actions)) {
          if (entity["@UI.Facets"]) {
            const targetProperties = se["@Common.SideEffects.TargetProperties"];
            if (targetProperties?.length >= 0) {
              if (targetProperties.findIndex((item) => item === "changes") === -1) {
                targetProperties.push("changes");
              }
            } else {
              se["@Common.SideEffects.TargetProperties"] = ["changes"];
            }
          }
          // When the custom action of the child entity is performed, the change history list of the parent entity is updated
          for (const entityName in m.definitions) {
            const parentName = m.definitions[entityName];
            if (parentName.elements) {
              for (const ele in parentName.elements) {
                const element = parentName.elements[ele];
                if (element.target === name && element.type === "cds.Composition") {
                  for (const eleName in entity.elements) {
                    if (entity.elements[eleName].target === entityName) {
                      const targetEntities = se["@Common.SideEffects.TargetEntities"];
                      if (targetEntities?.length >= 0) {
                        targetEntities.findIndex(
                          (item) => item["="] === `${eleName}.changes`
                        ) === -1 &&
                          targetEntities.push({
                            "=": `${eleName}.changes`
                          });
                      } else {
                        se["@Common.SideEffects.TargetEntities"] = [
                          { "=": `${eleName}.changes` }
                        ];
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
})

// Add generic change tracking handlers
cds.on('served', () => {
  const { track_changes, _afterReadChangeView } = require("./lib/change-log")
  for (const srv of cds.services) {
    if (srv instanceof cds.ApplicationService) {
      let any = false
      for (const entity of Object.values(srv.entities)) {
        if (isChangeTracked(entity)) {
          cds.db.before("CREATE", entity, track_changes)
          cds.db.before("UPDATE", entity, track_changes)
          cds.db.before("DELETE", entity, track_changes)
          any = true
        }
      }
      if (any && srv.entities.ChangeView) {
        srv.after("READ", srv.entities.ChangeView, _afterReadChangeView)
      }
    }
  }
})
