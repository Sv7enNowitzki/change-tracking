const cds = require("@sap/cds");

module.exports = cds.service.impl(async (srv) => {
    srv.before("CREATE", "BookStores", async (req) => {
        const newBookStores = req.data;
        newBookStores.lifecycleStatus_code = "IP";
    });
    const onActivateBooks = async (req) => {
        const entity = req.entity;
        const entityID = req._params[req._params.length - 1].ID;
        await UPDATE.entity(entity)
          .where({ ID: entityID })
          .set({ ActivationStatus_code: "VALID" });
    };

    const onActivateOrderItems = async (req) => {
        const entity = req.entity;
        const entityID = req._params[req._params.length - 1];
        await UPDATE.entity(entity)
          .where({ ID: entityID })
          .set({ ActivationStatus_code: "VALID" });
    };
    srv.on("activate", "Books", onActivateBooks);
    srv.on("activate", "OrderItem", onActivateOrderItems);
});
