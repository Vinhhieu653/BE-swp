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


router.get('/api/blogs', async (req, res) => {
    try {
        // Truy vấn cơ sở dữ liệu để lấy dữ liệu từ bảng blog
        const [rows, fields] = await pool.execute('SELECT blog_id, title, content, image FROM blog');

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
        const [rows, fields] = await pool.execute('SELECT title, content, image FROM blog WHERE blog_id = ?', [blogId]);

        if (rows.length > 0) {
            const blog = {
                title: rows[0].title,
                content: rows[0].content,
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
        const [rows, fields] = await pool.execute('SELECT blog_id, title FROM `blog` WHERE blog_id != ? LIMIT 8', [blogId]);

        // Trả về danh sách các bài viết khác
        res.json(rows);
    } catch (error) {
        console.error('Error querying MySQL:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// Endpoint to add a new blog post
router.post('/api/blogs', async (req, res) => {
    const { title, content, image } = req.body;

    try {
        // Insert new blog post into the database
        const [result, _] = await pool.execute(
            'INSERT INTO `blog` (title, content, image) VALUES (?, ?, ?)',
            [title, content, image]
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
        const [rows, fields] = await pool.execute('SELECT * FROM `blog` WHERE title LIKE ?', [`%${searchTerm}%`]);

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


//change the profile
router.post('/api/update-profile', async (req, res) => {
    const { userId, email, fullname, address, phone } = req.body;

    try {
        // Kiểm tra xem userId có tồn tại không
        const userExistsQuery = 'SELECT * FROM `users` WHERE user_id = ?';
        const [userExistsResult] = await pool.execute(userExistsQuery, [userId]);

        if (userExistsResult.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Thực hiện cập nhật các trường chỉ định cho người dùng trong cơ sở dữ liệu
        const updateQuery = 'UPDATE `users` SET email = ?, fullname = ?, address = ?, phone = ? WHERE user_id = ?';
        const [updateResult] = await pool.execute(updateQuery, [email, fullname, address, phone, userId]);

        if (updateResult && updateResult.affectedRows > 0) {
            // Lấy thông tin người dùng sau khi cập nhật từ cơ sở dữ liệu
            const updatedUserQuery = 'SELECT * FROM `users` WHERE user_id = ?';
            const [updatedUserResult] = await pool.execute(updatedUserQuery, [userId]);

            if (updatedUserResult && updatedUserResult.length > 0) {
                const updatedUser = updatedUserResult[0];
                return res.status(200).json({ message: 'Profile updated successfully', user: updatedUser });
            } else {
                return res.status(500).json({ message: 'Failed to fetch updated profile' });
            }
        } else {
            return res.status(400).json({ message: 'Failed to update profile' });
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        return res.status(500).json({ message: 'Internal system error' });
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


// Endpoint API for Google user login/sign-up
router.post('/api/login/google', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    try {
        // Kiểm tra xem người dùng đã tồn tại trong cơ sở dữ liệu chưa
        const [existingUsers] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);

        let user = existingUsers.length > 0 ? existingUsers[0] : null;

        // Nếu người dùng không tồn tại, tạo một bản ghi người dùng mới
        if (!user) {
            const [result] = await pool.execute(
                'INSERT INTO users (email) VALUES (?)',
                [email]
            );

            user = {
                user_id: result.insertId,
                email: email
                // Các trường khác có thể phụ thuộc vào cấu trúc của bạn
            };
        }

        // Tạo token JWT
        const token = jwt.sign(
            { userId: user.user_id, email: user.email },
            secretKey,
            { expiresIn: '1h' }
        );

        // Trả về dữ liệu người dùng và token
        res.json({
            user: {
                id: user.user_id,
                email: user.email
                // Thêm các thuộc tính khác của người dùng nếu bạn muốn bao gồm chúng
            },
            token
        });
    } catch (error) {
        console.error('Error with Google login:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});



router.get('/api/users', async (req, res) => {
    try {
        // Truy vấn cơ sở dữ liệu để lấy dữ liệu từ bảng users
        const [rows, fields] = await pool.execute('SELECT username, fullname, address, phone, email FROM users');

        // Trả về dữ liệu lấy được từ cơ sở dữ liệu
        res.json({ users: rows });
    } catch (error) {
        console.error('Error querying MySQL:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.get('/api/staffs', async (req, res) => {
    try {
        // Truy vấn cơ sở dữ liệu để lấy dữ liệu từ bảng staffs
        const [rows, fields] = await pool.execute('SELECT  username, fullname, address, phone, email FROM users');

        // Trả về dữ liệu lấy được từ cơ sở dữ liệu
        res.json({ staffs: rows });
    } catch (error) {
        console.error('Error querying MySQL:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});



export default router;
