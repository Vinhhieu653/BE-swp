import express from "express";
import pool from "../configs/connectDb";
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');

const secretKey = '123';
const router = express.Router();



router.use(express.json());


// Endpoint API để lấy thông tin của một người dùng theo ID
router.get('/api/users/:id', async (req, res) => {
    const userId = req.params.id;
    try {
        const [rows, fields] = await pool.execute('SELECT * FROM `users` WHERE user_id = ?', [userId]);

        if (rows.length > 0) {
            const user = {
                id: rows[0].user_id,
                name: rows[0].fullname,
                username: rows[0].username,
                email: rows[0].email,
                phone: rows[0].phone,
                address: rows[0].address,
            };
            res.json({ user });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error querying MySQL:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Endpoint API for user login
router.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const [existingUsers, fields] = await pool.execute('SELECT * FROM `users` WHERE username = ?', [username]);

        if (existingUsers.length === 0) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const passwordMatch = await bcrypt.compare(password, existingUsers[0].password);

        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        // Generate a JWT token
        const token = jwt.sign(
            { userId: existingUsers[0].id, username: existingUsers[0].username },
            secretKey,
            { expiresIn: '1h' }
        );

        // Return user data and token
        const user = {
            id: existingUsers[0].user_id,
            username: existingUsers[0].username,
            fullname: existingUsers[0].fullname,
            email: existingUsers[0].email,
            phone: existingUsers[0].phone,
            address: existingUsers[0].address,

        };

        res.json({ user, token });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ message: 'Internal system error' });
    }
});


router.post('/api/register', async (req, res) => {
    const { username, fullname, email, password, address, phone } = req.body;

    try {
        // check if the user exists
        const [existingUsers, fields] = await pool.execute('SELECT * FROM `users` WHERE username = ?', [username]);

        if (existingUsers.length > 0) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        // hash
        const hashedPassword = await bcrypt.hash(password, 10);

        // add user
        const [result, _] = await pool.execute(
            'INSERT INTO `users` (username, fullname, email, password, address, phone) VALUES (?, ?, ?, ?, ?, ?)',
            [username, fullname, email, hashedPassword, address, phone]
        );

        const userId = result.insertId;

        // Trả về thông tin người dùng đã đăng ký
        const registeredUser = {
            id: userId,
            username,
            fullname,
            email,
            address,
            phone,
        };

        res.status(201).json({ user: registeredUser, message: 'User registered successfully' });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'Internal system error' });
    }
});

router.post('/api/update-profile', async (req, res) => {
    const userId = req.body.userId; // Sử dụng userId trực tiếp từ request body

    const { email, fullname, address, phone } = req.body;

    try {
        // Thực hiện cập nhật các trường chỉ định cho người dùng trong cơ sở dữ liệu
        const [result, _] = await pool.execute(
            'UPDATE `users` SET email = ?, fullname = ?, address = ?, phone = ? WHERE user_id = ?',
            [email, fullname, address, phone, userId]
        );

        if (result.affectedRows > 0) {
            // Lấy thông tin người dùng sau khi cập nhật từ cơ sở dữ liệu
            const [updatedUser, _] = await pool.execute(
                'SELECT * FROM `users` WHERE user_id = ?',
                [userId]
            );

            res.status(200).json({ message: 'Profile updated successfully', user: updatedUser[0] });
        } else {
            res.status(400).json({ message: 'Failed to update profile' });
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Internal system error' });
    }
});

router.get('/api/blogs', async (req, res) => {
    try {
        // Truy vấn cơ sở dữ liệu để lấy dữ liệu từ bảng blog
        const [rows, fields] = await pool.execute('SELECT post_id, title, content, category, image FROM post');

        // Trả về dữ liệu lấy được từ cơ sở dữ liệu
        res.json({ posts: rows });
    } catch (error) {
        console.error('Error querying MySQL:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// Route API để lấy thông tin của một bài viết từ bảng blog theo ID
router.get('/api/blogs/:id', async (req, res) => {
    const blogId = req.params.id;

    try {
        // Truy vấn cơ sở dữ liệu để lấy thông tin của bài viết theo ID
        const [rows, fields] = await pool.execute('SELECT title, content, category, image FROM post WHERE post_id = ?', [blogId]);

        if (rows.length > 0) {
            const blog = {
                title: rows[0].title,
                content: rows[0].content,
                category: rows[0].category, // Thêm trường category vào đối tượng blog
                image: rows[0].image
            };
            res.json(blog);
        } else {
            res.status(404).json({ message: 'Blog not found' });
        }
    } catch (error) {
        console.error('Error querying MySQL:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});




// Endpoint API để lấy danh sách các bài viết khác dựa trên ID của bài viết hiện tại
router.get('/api/blogs/:id/other-blogs', async (req, res) => {
    const blogId = req.params.id;

    try {
        // Truy vấn cơ sở dữ liệu để lấy danh sách các bài viết khác dựa trên ID
        const [rows, fields] = await pool.execute('SELECT post_id, title FROM `post` WHERE post_id != ? LIMIT 8', [blogId]);

        // Trả về danh sách các bài viết khác
        res.json(rows);
    } catch (error) {
        console.error('Error querying MySQL:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// Endpoint to add a new blog post
router.post('/api/blogs', async (req, res) => {
    const { title, content, image, category } = req.body; // Thêm trường category từ req.body

    try {
        // Insert new blog post into the database
        const [result, _] = await pool.execute(
            'INSERT INTO `post` (title, content, image, category) VALUES (?, ?, ?, ?)', // Thêm trường category vào câu truy vấn SQL
            [title, content, image, category]
        );

        if (result.affectedRows > 0) {
            res.status(200).json({ message: 'Blog post added successfully' });
        } else {
            res.status(400).json({ message: 'Failed to add blog post' });
        }
    } catch (error) {
        console.error('Error adding blog post:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// POST request để tìm kiếm bài viết theo tiêu đề
router.post('/search-blogs', async (req, res) => {
    const searchTerm = req.body.searchTerm;

    try {
        // Truy vấn cơ sở dữ liệu để tìm kiếm bài viết phù hợp với từ khóa tìm kiếm
        const [rows, fields] = await pool.execute('SELECT * FROM `post` WHERE title LIKE ?', [`%${searchTerm}%`]);

        res.json(rows); // Trả về kết quả tìm kiếm
    } catch (error) {
        console.error('Lỗi truy vấn cơ sở dữ liệu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
});


router.get('/api/quotation', async (req, res) => {
    try {
        // Truy vấn cơ sở dữ liệu để lấy dữ liệu từ bảng quotation
        const [rows, fields] = await pool.execute('SELECT title, content, date, price, status FROM `quotation`');

        // Trả về dữ liệu lấy được từ cơ sở dữ liệu
        res.json({ quotations: rows });
    } catch (error) {
        console.error('Error querying MySQL:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// Route API để lấy danh sách các dự án xây dựng
router.get('/api/construction-projects', async (req, res) => {
    try {
        // Truy vấn cơ sở dữ liệu để lấy dữ liệu từ bảng construction_project
        const [rows, fields] = await pool.execute('SELECT construction_project_id, title, content, image FROM construction_project');

        // Trả về dữ liệu lấy được từ cơ sở dữ liệu
        res.json({ constructionProjects: rows });
    } catch (error) {
        console.error('Error querying MySQL:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Route API để lấy thông tin của một dự án xây dựng theo ID
router.get('/api/construction-projects/:id', async (req, res) => {
    const projectId = req.params.id;

    try {
        // Truy vấn cơ sở dữ liệu để lấy thông tin của dự án xây dựng
        const [rows, fields] = await pool.execute('SELECT construction_project_id, title, content, image FROM construction_project WHERE construction_project_id = ?', [projectId]);

        if (rows.length > 0) {
            const project = {
                construction_project_id: rows[0].construction_project_id,
                title: rows[0].title,
                content: rows[0].content,
                image: rows[0].image,
            };
            res.json(project);
        } else {
            res.status(404).json({ message: 'Construction project not found' });
        }
    } catch (error) {
        console.error('Error querying MySQL:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});



// Endpoint API để lấy danh sách các dự án xây dựng đã hoàn thành
router.get('/api/completed-construction-projects', async (req, res) => {
    try {
        // Truy vấn cơ sở dữ liệu để lấy dữ liệu từ bảng completed_construction_project
        const [rows, fields] = await pool.execute('SELECT completed_construction_project_id, title, content, image FROM completed_construction_project');

        // Trả về dữ liệu lấy được từ cơ sở dữ liệu
        res.json({ completedConstructionProjects: rows });
    } catch (error) {
        console.error('Error querying MySQL:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// GET request to fetch a completed construction project by ID
router.get('/completed-construction-projects/:id', async (req, res) => {
    const projectId = req.params.id;

    try {
        // Query the database to get the completed construction project by ID
        const [rows, fields] = await pool.execute('SELECT * FROM `completed_construction_project` WHERE completed_construction_project_id = ?', [projectId]);

        if (rows.length > 0) {
            res.json(rows[0]); // Return the first row as the project details
        } else {
            res.status(404).json({ message: 'Completed construction project not found' });
        }
    } catch (error) {
        console.error('Error querying MySQL:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// Định nghĩa endpoint API để lấy dữ liệu người dùng
router.get('/api/users', async (req, res) => {
    try {
        // Truy vấn cơ sở dữ liệu để lấy dữ liệu từ bảng users
        const [rows, fields] = await pool.execute('SELECT user_id, username, fullname, address, phone, email FROM users');

        // Trả về dữ liệu lấy được từ cơ sở dữ liệu
        res.json({ users: rows });
    } catch (error) {
        console.error('Error querying MySQL:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


router.delete('/api/users/:id', async (req, res) => {
    const userId = req.params.id;

    try {
        // Truy vấn cơ sở dữ liệu để xóa người dùng với ID tương ứng
        const [result, fields] = await pool.execute('DELETE FROM users WHERE user_id = ?', [userId]);

        // Kiểm tra xem có bao nhiêu bản ghi đã bị ảnh hưởng
        if (result.affectedRows > 0) {
            // Nếu có ít nhất một bản ghi bị ảnh hưởng, trả về thành công
            res.json({ message: 'User deleted successfully' });
        } else {
            // Nếu không có bản ghi nào bị ảnh hưởng, người dùng không tồn tại
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error querying MySQL:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Route to update user profile
router.put('/api/update-profile/:userId', async (req, res) => {
    const userId = req.params.userId;
    const { email, fullname, address, phone } = req.body;

    try {
        // Query to update user profile in the database
        const [result, _] = await pool.execute(
            'UPDATE users SET email = ?, fullname = ?, address = ?, phone = ? WHERE user_id = ?',
            [email, fullname, address, phone, userId]
        );

        // Check if user profile was updated successfully
        if (result.affectedRows > 0) {
            res.status(200).json({ message: 'User profile updated successfully' });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



// GET user by ID
router.get('/api/users/:userId', async (req, res) => {
    const userId = req.params.id;

    try {
        // Truy vấn cơ sở dữ liệu để lấy thông tin người dùng theo ID
        const [rows, fields] = await pool.execute('SELECT * FROM users WHERE user_id = ?', [userId]);

        // Kiểm tra xem người dùng với ID cụ thể có tồn tại không
        if (rows.length > 0) {
            // Nếu người dùng tồn tại, gửi dữ liệu người dùng dưới dạng phản hồi JSON
            res.json(rows[0]);
        } else {
            // Nếu người dùng không tồn tại, gửi thông báo lỗi
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        // Nếu có lỗi, gửi thông báo lỗi
        console.error('Error fetching user data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});




export default router;
