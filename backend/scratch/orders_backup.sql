-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Jul 06, 2026 at 12:56 PM
-- Server version: 11.8.8-MariaDB-log
-- PHP Version: 7.2.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `u581231108_SGB_CRM_test1`
--

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `order_id` int(11) NOT NULL,
  `order_source` enum('lead','dealer') NOT NULL,
  `lead_id` int(11) DEFAULT NULL,
  `dealer_id` int(11) DEFAULT NULL,
  `customer_name` varchar(150) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `district` varchar(100) DEFAULT NULL,
  `order_status` enum('draft','in_review','billed','packed','shipped','delivered','cancelled') DEFAULT 'draft',
  `created_by` int(11) DEFAULT NULL,
  `billing_done_by` int(11) DEFAULT NULL,
  `total_amount` decimal(10,2) DEFAULT 0.00,
  `discount` decimal(10,2) DEFAULT 0.00,
  `shipping_charges` decimal(10,2) DEFAULT 0.00,
  `advance_amount` decimal(10,2) DEFAULT 0.00,
  `balance_amount` decimal(10,2) DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_locked` tinyint(1) DEFAULT 0,
  `locked_by` int(11) DEFAULT NULL,
  `pincode` varchar(10) DEFAULT NULL,
  `delivery_type` varchar(100) DEFAULT NULL,
  `dispatch_through` varchar(100) DEFAULT NULL,
  `shipping_name` varchar(150) DEFAULT NULL,
  `shipping_address` text DEFAULT NULL,
  `shipping_city` varchar(100) DEFAULT NULL,
  `shipping_state` varchar(100) DEFAULT NULL,
  `shipping_pincode` varchar(10) DEFAULT NULL,
  `extra_charges` decimal(10,2) DEFAULT 0.00,
  `village` varchar(100) DEFAULT NULL,
  `sub_district` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`order_id`, `order_source`, `lead_id`, `dealer_id`, `customer_name`, `phone`, `address`, `city`, `state`, `district`, `order_status`, `created_by`, `billing_done_by`, `total_amount`, `discount`, `shipping_charges`, `advance_amount`, `balance_amount`, `created_at`, `updated_at`, `is_locked`, `locked_by`, `pincode`, `delivery_type`, `dispatch_through`, `shipping_name`, `shipping_address`, `shipping_city`, `shipping_state`, `shipping_pincode`, `extra_charges`, `village`, `sub_district`) VALUES
(74, 'lead', 149, NULL, 'darshan test', '6364594854', 'f', 'f', 'Karnataka', '', 'shipped', 1, 1, 3500.00, 0.00, 0.00, 0.00, 3500.00, '2026-05-23 14:37:06', '2026-06-04 07:16:40', 1, NULL, '', 'Post office COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(75, 'lead', 214, NULL, 'ver', '1234567291', 'adagur', 'adagur', 'Karnataka', 'tumkur', 'shipped', 1, NULL, 3500.00, 0.00, 0.00, 0.00, 3500.00, '2026-05-23 15:51:10', '2026-06-04 07:12:25', 1, NULL, '572216', 'VRL COD', 'Other', NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(76, 'lead', 214, NULL, 'ver', '1234567291', 'adagur', 'adagur', 'Karnataka', 'tre', 'packed', 1, NULL, 3500.00, 0.00, 0.00, 0.00, 3500.00, '2026-05-23 15:55:49', '2026-06-01 09:05:47', 1, NULL, '572216', 'Post office COD', 'Other', NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(77, 'lead', 214, NULL, 'ver', '1234567291', 'adagurertyfgf', 'adagurertyfgf', 'Karnataka', 'treer', 'billed', 1, NULL, 5000.00, 0.00, 0.00, 0.00, 5000.00, '2026-05-23 16:05:21', '2026-05-23 16:18:33', 1, NULL, '572215', 'Post office COD', 'Other', NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(78, 'lead', 213, NULL, '-', '9901688204', '', '', 'Karnataka', '', 'shipped', 1, 1, 4100.00, 0.00, 0.00, 1000.00, 3100.00, '2026-05-25 06:23:27', '2026-05-25 06:26:36', 1, NULL, '', 'Post office COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(79, 'lead', 210, NULL, '-', '7773040895', '', '', 'Karnataka', '', 'shipped', 1, 1, 4600.00, 0.00, 0.00, 999.00, 3601.00, '2026-05-25 09:21:23', '2026-05-25 09:22:56', 1, NULL, '', 'Post office COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(80, 'lead', 221, NULL, 'Mohit', '7014396299', '', '', '', 'Bangalore', 'packed', 1, 1, 4000.00, 0.00, 0.00, 1000.00, 3000.00, '2026-05-26 11:16:56', '2026-05-26 11:21:49', 1, NULL, '', 'Post office COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(81, 'lead', 225, NULL, 'aravind', '8867724615', 'koppa', 'koppa', 'Karnataka', 'chikmagaluru', 'billed', 1, 1, 15000.00, 0.00, 0.00, 1000.00, 14000.00, '2026-05-27 05:20:06', '2026-05-27 09:29:18', 1, NULL, '577126', 'Post office COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(82, 'lead', 225, NULL, 'aravind', '8867724615', 'koppa', 'koppa', 'Karnataka', 'chikmagaluru', 'draft', 1, NULL, 15000.00, 0.00, 0.00, 1000.00, 14000.00, '2026-05-27 05:20:13', '2026-05-27 05:20:13', 0, NULL, '577126', 'Post office COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(83, 'lead', 225, NULL, 'aravind', '8867724615', 'koppa', 'koppa', 'Karnataka', 'chikmagaluru', 'shipped', 1, 1, 600.00, 0.00, 0.00, 0.00, 600.00, '2026-05-27 05:21:08', '2026-05-27 09:28:48', 1, NULL, '577126', 'Post office COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(84, 'lead', 222, NULL, '-', '9845032710', '', '', 'Karnataka', '', 'draft', 1, NULL, 15000.00, 0.00, 0.00, 1000.00, 14000.00, '2026-05-27 05:47:45', '2026-05-27 05:47:45', 0, NULL, '', 'VRL COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(85, 'lead', 222, NULL, '-', '9845032710', '', '', 'Karnataka', '', 'draft', 1, NULL, 600.00, 0.00, 0.00, 1000.00, -400.00, '2026-05-27 05:47:56', '2026-05-27 05:47:56', 0, NULL, '', 'VRL COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(86, 'lead', 310, NULL, 'shashi kumar', '9964038635', 'channaraya patna', 'channaraya patna', 'Karnataka', 'ramanagara', 'draft', 1, NULL, 8500.00, 0.00, 0.00, 7500.00, 1000.00, '2026-05-28 09:12:27', '2026-05-28 09:12:27', 0, NULL, '562138', 'VRL COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(87, 'lead', 255, NULL, 'lankesh', '9964656660', 'channagiri', 'channagiri', 'Karnataka', 'davanagere', 'draft', 1, NULL, 8500.00, 0.00, 0.00, 1000.00, 7500.00, '2026-05-29 09:25:20', '2026-05-29 09:25:20', 0, NULL, '', 'VRL COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(88, 'lead', 149, NULL, 'darshan test', '6364594854', 'f', 'f', 'Karnataka', 'tumk', 'draft', 1, NULL, 2000.00, 0.00, 0.00, 100.00, 1900.00, '2026-05-30 07:46:48', '2026-05-30 07:46:48', 0, NULL, '572212', 'VRL COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(89, 'lead', 443, NULL, 'sharath kumar', '9591476425', '', '', 'Karnataka', 'shimogga', 'draft', 1, NULL, 8500.00, 0.00, 0.00, 999.00, 7501.00, '2026-06-01 05:49:05', '2026-06-01 05:49:05', 0, NULL, '', 'VRL COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(90, 'lead', 221, NULL, 'Mohit', '7014396299', 'bangalore', 'bangalore', 'KA', 'Bangalore', 'shipped', 1, 1, 8500.00, 0.00, 0.00, 1000.00, 7500.00, '2026-06-01 05:51:17', '2026-06-01 05:55:27', 1, NULL, '', 'VRL COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(91, 'lead', 593, NULL, 'RAGHU', '7676403945', '', '', 'Karnataka', 'MYSORE', 'draft', 1, NULL, 8500.00, 0.00, 0.00, 1000.00, 7500.00, '2026-06-03 11:17:48', '2026-06-03 11:17:48', 0, NULL, '', 'VRL COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(92, 'lead', 617, NULL, 'JEEVAN', '9448005504', '', '', 'Karnataka', 'MANDYA', 'draft', 1, NULL, 3500.00, 0.00, 0.00, 500.00, 3000.00, '2026-06-03 11:27:08', '2026-06-03 11:27:08', 0, NULL, '', 'Post office COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(93, 'lead', 617, NULL, 'JEEVAN', '9448005504', '', '', 'Karnataka', 'MANDYA', 'draft', 1, NULL, 600.00, 0.00, 0.00, 0.00, 600.00, '2026-06-03 11:29:23', '2026-06-03 11:29:23', 0, NULL, '', 'Post office COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(94, 'lead', 650, NULL, 'dar', '8217286727', 'Belagumba, Tumkur, Karnataka - 572104\nPh: 8217286727', '', 'Karnataka', 'Tumkur', 'shipped', 1, NULL, 13000.00, 0.00, 0.00, 0.00, 13000.00, '2026-06-04 07:05:58', '2026-06-04 07:14:30', 1, NULL, '572104', 'Post office COD', 'Other', NULL, NULL, NULL, NULL, NULL, 0.00, 'Belagumba', NULL),
(95, 'lead', 506, NULL, 'DEEPAK', '9818340756', '', '', 'Karnataka', 'UDUPI', 'draft', 1, NULL, 11000.00, 0.00, 0.00, 500.00, 10500.00, '2026-06-05 04:15:53', '2026-06-05 04:15:53', 0, NULL, '', 'Post office COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(96, 'lead', 506, NULL, 'DEEPAK', '9818340756', '', '', 'Karnataka', 'UDUPI', 'draft', 1, NULL, 11000.00, 0.00, 0.00, 500.00, 10500.00, '2026-06-05 04:16:00', '2026-06-05 04:16:00', 0, NULL, '', 'Post office COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(97, 'lead', 506, NULL, 'DEEPAK', '9818340756', '', '', 'Karnataka', 'UDUPI', 'draft', 1, NULL, 11000.00, 0.00, 0.00, 500.00, 10500.00, '2026-06-05 04:16:13', '2026-06-05 04:16:13', 0, NULL, '', 'Post office COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(98, 'lead', 506, NULL, 'DEEPAK', '9818340756', '', '', 'Karnataka', 'UDUPI', 'draft', 1, NULL, 11000.00, 0.00, 0.00, 500.00, 10500.00, '2026-06-05 04:17:32', '2026-06-05 04:17:32', 0, NULL, '', 'Post office COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(99, 'lead', 506, NULL, 'DEEPAK', '9818340756', '', '', 'Karnataka', 'UDUPI', 'draft', 1, NULL, 11000.00, 0.00, 0.00, 500.00, 10500.00, '2026-06-05 04:17:38', '2026-06-05 04:17:38', 0, NULL, '', 'Post office COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(100, 'lead', 506, NULL, 'DEEPAK', '9818340756', '', '', 'Karnataka', 'UDUPI', 'draft', 1, NULL, 11000.00, 0.00, 0.00, 500.00, 10500.00, '2026-06-05 04:17:45', '2026-06-05 04:17:45', 0, NULL, '', 'Post office COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(101, 'lead', 506, NULL, 'DEEPAK', '9818340756', '', '', 'Karnataka', 'UDUPI', 'draft', 1, NULL, 11000.00, 0.00, 0.00, 496.00, 10504.00, '2026-06-05 04:42:14', '2026-06-05 04:42:14', 0, NULL, '', 'Post office COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL),
(102, 'lead', 767, NULL, 'sa', '7026496890', 'sa', 'sa', 'Karnataka', 'sa', 'draft', 1, NULL, 7500.00, 0.00, 0.00, 1000.00, 6500.00, '2026-07-06 05:55:27', '2026-07-06 05:55:27', 0, NULL, '577126', 'VRL COD', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '', NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`order_id`),
  ADD KEY `lead_id` (`lead_id`),
  ADD KEY `dealer_id` (`dealer_id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `billing_done_by` (`billing_done_by`),
  ADD KEY `fk_orders_locked_by` (`locked_by`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `order_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=103;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_locked_by` FOREIGN KEY (`locked_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`lead_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`dealer_id`) REFERENCES `dealers` (`dealer_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `orders_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `orders_ibfk_4` FOREIGN KEY (`billing_done_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
