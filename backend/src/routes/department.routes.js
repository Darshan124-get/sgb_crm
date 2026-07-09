const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/department.controller');
const { authenticateToken, isAdmin, isManagerOrAdmin } = require('../middleware/auth.middleware');

router.use(authenticateToken);

router.get('/', isManagerOrAdmin, departmentController.getAllDepartments);
router.post('/', isAdmin, departmentController.createDepartment);
router.put('/:id', isAdmin, departmentController.updateDepartment);
router.delete('/:id', isAdmin, departmentController.deleteDepartment);

module.exports = router;
