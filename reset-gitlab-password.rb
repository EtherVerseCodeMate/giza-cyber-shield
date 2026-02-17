user = User.find_by(username: 'root')
user.password = 'Phantom2026Guardian'
user.password_confirmation = 'Phantom2026Guardian'
user.save!
puts "Root password has been reset to: Phantom2026Guardian"
