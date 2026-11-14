const ReportService = require('../services/reportService')

exports.resumen = async (req, res) => {
    res.json(await ReportService.resumen())
}
